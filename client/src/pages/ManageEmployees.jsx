import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';

const PERMISSION_OPTIONS = [
  { key: 'manage_inventory', label: 'Manage Inventory' },
  { key: 'manage_orders', label: 'Manage Orders' },
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'manage_riders', label: 'Manage Riders' },
];

export default function ManageEmployees() {
  const { user } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load employees.');
    } finally {
      setLoading(false);
    }
  }

  function togglePermission(key) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  async function handleAddEmployee(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      await api.post('/employees', { name, email, password, permissions });
      setName('');
      setEmail('');
      setPassword('');
      setPermissions([]);
      loadEmployees();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not add employee.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePermission(employeeId, key, currentPermissions) {
    const next = currentPermissions.includes(key)
      ? currentPermissions.filter((p) => p !== key)
      : [...currentPermissions, key];

    try {
      await api.patch(`/employees/${employeeId}`, { permissions: next });
      loadEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update permissions.');
    }
  }

  async function handleRemove(employeeId) {
    if (!window.confirm('Remove this employee?')) return;
    try {
      await api.delete(`/employees/${employeeId}`);
      loadEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove employee.');
    }
  }

  return (
    <AppShell>
      <div>
        <div className="manage-card">
          <h1>Manage Employees</h1>
          <p className="subtitle" style={{ marginBottom: 24 }}>
            Store: {user.store?.name || 'Not set'}
          </p>

          {error && <div className="message error">{error}</div>}

          <form onSubmit={handleAddEmployee} className="employee-form">
            {formError && <div className="message error">{formError}</div>}

            <div className="form-row">
              <div className="field">
                <label htmlFor="empName">Full Name</label>
                <input
                  id="empName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="empEmail">Email</label>
                <input
                  id="empEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="empPassword">Password</label>
                <input
                  id="empPassword"
                  type="password"
                  required
                  minLength={8}
                  title="At least 8 characters with a letter and a number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Permissions</label>
              <div className="permission-checkboxes">
                {PERMISSION_OPTIONS.map((opt) => (
                  <label key={opt.key} className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={permissions.includes(opt.key)}
                      onChange={() => togglePermission(opt.key)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Employee'}
            </button>
          </form>

          <h2 className="section-heading">Current Employees</h2>

          {loading ? (
            <p className="placeholder-note">Loading...</p>
          ) : employees.length === 0 ? (
            <p className="placeholder-note">No employees yet. Add your first one above.</p>
          ) : (
            <div className="employee-list">
              {employees.map((emp) => (
                <div key={emp.id} className="employee-row">
                  <div>
                    <strong>{emp.name}</strong>
                    <span className="employee-email">{emp.email}</span>
                  </div>
                  <div className="permission-checkboxes">
                    {PERMISSION_OPTIONS.map((opt) => (
                      <label key={opt.key} className="checkbox-pill small">
                        <input
                          type="checkbox"
                          checked={emp.permissions.includes(opt.key)}
                          onChange={() => handleTogglePermission(emp.id, opt.key, emp.permissions)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <button className="remove-btn" onClick={() => handleRemove(emp.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
