import React, { useState, useEffect } from 'react';
import axios from 'axios';

// IMPORTANT: Change this URL to your Railway backend URL when you deploy!
const API_URL = "http://localhost:8000";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [tasks, setTasks] = useState([]);
  
  // Auth Form State
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signupRole, setSignupRole] = useState("Member"); 

  useEffect(() => {
    if (token) fetchTasks();
  }, [token]);

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/signup`, { 
        username, 
        password, 
        role: signupRole 
      });
      alert("Signup successful! You can now log in.");
      setIsLoginView(true); 
      setPassword(""); 
    } catch (err) {
      alert("Signup failed. That username might already be taken.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password });
      setToken(res.data.access_token);
      setRole(res.data.role);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('role', res.data.role);
    } catch (err) {
      alert("Login failed. Check your username and password.");
    }
  };

  // --- THE FIX IS HERE: Sending token as a URL parameter ---
  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/tasks?token=${token}`);
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  const updateStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API_URL}/tasks/${taskId}/status?token=${token}`, 
        { status: newStatus }
      );
      fetchTasks(); // Refresh list after update
    } catch (err) {
      alert("Failed to update status. You might not have permission.");
    }
  };
  // ---------------------------------------------------------

  const logout = () => {
    setToken(null);
    setRole(null);
    localStorage.clear();
    setUsername("");
    setPassword("");
  };

  // --- UI: AUTHENTICATION SCREEN ---
  if (!token) {
    return (
      <div style={{ padding: '2rem', maxWidth: '400px', margin: '40px auto', fontFamily: 'sans-serif', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', marginTop: 0 }}>
          {isLoginView ? 'Login to Task Manager' : 'Create an Account'}
        </h2>
        
        <form onSubmit={isLoginView ? handleLogin : handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          
          {!isLoginView && (
             <select 
               value={signupRole} 
               onChange={e => setSignupRole(e.target.value)}
               style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
             >
               <option value="Member">Member</option>
               <option value="Admin">Admin</option>
             </select>
          )}

          <button type="submit" style={{ padding: '10px', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
            {isLoginView ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            onClick={() => setIsLoginView(!isLoginView)}
            style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLoginView ? "Don't have an account? Sign up here." : "Already have an account? Log in."}
          </button>
        </div>
      </div>
    );
  }

  // --- UI: DASHBOARD SCREEN ---
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <h2>Dashboard <span style={{fontSize: '1rem', color: '#666'}}>({role})</span></h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
           <span style={{ fontWeight: 'bold' }}>Welcome, {username || 'User'}</span>
           <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>Logout</button>
        </div>
      </header>

      {role === "Admin" && (
        <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', padding: '1rem', marginBottom: '2rem', borderRadius: '4px' }}>
          <h3 style={{ marginTop: 0 }}>Admin Controls</h3>
          <p style={{ marginBottom: 0 }}>
            Use the <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer">Swagger API</a> to Create Projects and Assign Tasks to your new users.
          </p>
        </div>
      )}

      <h3>Your Tasks</h3>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {tasks.length === 0 ? <p style={{ color: '#666' }}>No tasks assigned to you right now.</p> : tasks.map(task => (
          <div key={task.id} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', minWidth: '220px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>{task.title}</h4>
            <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem' }}>Status: <strong>{task.status}</strong></p>
            <select 
              value={task.status} 
              onChange={(e) => updateStatus(task.id, e.target.value)}
              style={{ width: '100%', padding: '6px' }}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;