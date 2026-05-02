from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from pydantic import BaseModel
from typing import List, Optional
import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext

# --- Configuration & Auth Setup ---
SECRET_KEY = "super-secret-key-change-this-later"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Database Setup (SQLite for local speed) ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./taskapp.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Models (Database) ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="Member") # "Admin" or "Member"

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    tasks = relationship("Task", back_populates="project")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    status = Column(String, default="Pending") # Pending, In Progress, Completed
    project_id = Column(Integer, ForeignKey("projects.id"))
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    project = relationship("Project", back_populates="tasks")

Base.metadata.create_all(bind=engine)

# --- Schemas (Pydantic for Validation) ---
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "Member"

class TaskCreate(BaseModel):
    title: str
    project_id: int
    assigned_to: Optional[int] = None

class TaskStatusUpdate(BaseModel):
    status: str

# --- Dependencies ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.query(User).filter(User.username == payload.get("sub")).first()
        if user is None: raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# --- App & Routes ---
app = FastAPI()

# CORS for frontend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/auth/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    hashed_pw = pwd_context.hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_pw, role=user.role)
    db.add(db_user)
    db.commit()
    return {"message": "User created successfully"}

@app.post("/auth/login")
def login(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    token = create_access_token(data={"sub": db_user.username, "role": db_user.role})
    return {"access_token": token, "role": db_user.role}

@app.post("/projects", dependencies=[Depends(require_admin)])
def create_project(name: str, db: Session = Depends(get_db)):
    project = Project(name=name)
    db.add(project)
    db.commit()
    return {"message": "Project created"}

@app.get("/tasks")
def get_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "Admin":
        return db.query(Task).all() # Admins see all
    return db.query(Task).filter(Task.assigned_to == current_user.id).all() # Members see their own

@app.post("/tasks", dependencies=[Depends(require_admin)])
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = Task(**task.dict())
    db.add(db_task)
    db.commit()
    return {"message": "Task created"}

@app.put("/tasks/{task_id}/status")
def update_task_status(task_id: int, status_update: TaskStatusUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    
    if current_user.role != "Admin" and task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this task")
        
    task.status = status_update.status
    db.commit()
    return {"message": "Status updated"}