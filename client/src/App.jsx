import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ManageEmployees from './pages/ManageEmployees';
import ManageInventory from './pages/ManageInventory';
import StoreOrders from './pages/StoreOrders';
import StoreAnalytics from './pages/StoreAnalytics';
import CustomerOrders from './pages/CustomerOrders';

const guard = (element, roles) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={guard(<Dashboard />)} />
          <Route path="/orders" element={guard(<CustomerOrders />, ['customer'])} />
          <Route path="/employees" element={guard(<ManageEmployees />, ['owner'])} />
          <Route path="/inventory" element={guard(<ManageInventory />, ['owner', 'employee'])} />
          <Route path="/store-orders" element={guard(<StoreOrders />, ['owner', 'employee'])} />
          <Route path="/analytics" element={guard(<StoreAnalytics />, ['owner', 'employee'])} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </CartProvider>
    </AuthProvider>
  );
}
