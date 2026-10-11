// Shared branding panel for Login/Register - a proper split-screen side
// instead of the old centered-box-on-a-gradient look.
export default function AuthVisual() {
  return (
    <div className="auth-visual">
      <div className="auth-visual-glow" />
      <div className="auth-visual-inner">
        <div className="brand">
          <span className="brand-badge">
            <img src="/assets/logo-transparent.png" alt="PureGasly logo" />
          </span>
          <span>PureGasly</span>
        </div>

        <h1>LPG delivery, made simple.</h1>
        <p>Order from trusted local stores, track every delivery in real time, and never run out of gas again.</p>

        <ul className="auth-highlights">
          <li>
            <span className="auth-highlight-icon">🔥</span>
            <div>
              <strong>Live order tracking</strong>
              <span>Preparing → Out for delivery → Delivered</span>
            </div>
          </li>
          <li>
            <span className="auth-highlight-icon">🏪</span>
            <div>
              <strong>Multiple verified stores</strong>
              <span>Compare prices, promos, and ratings</span>
            </div>
          </li>
          <li>
            <span className="auth-highlight-icon">🎟️</span>
            <div>
              <strong>Exclusive coupons</strong>
              <span>Save on your next refill</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
