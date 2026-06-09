export default function PolicyFooter() {
  return (
    <>
      <style>{`
        .footer-link {
          color: #e5e7eb;
          text-decoration: none;
          font-size: 13px;
          margin-bottom: 8px;
          display: block;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: #C9A84C;
        }
      `}</style>
      <footer style={{
        background: "#1B2A4A",
        color: "white",
        padding: "40px 20px",
        marginTop: "auto",
        borderTop: "1px solid #374151"
      }}>
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "30px", marginBottom: "30px" }}>
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "#C9A84C" }}>Company</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li><a href="/" className="footer-link">Home</a></li>
                <li><a href="/privacy-policy" className="footer-link">Privacy Policy</a></li>
                <li><a href="/terms" className="footer-link">Terms & Conditions</a></li>
                <li><a href="/refund-policy" className="footer-link">Refund Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "#C9A84C" }}>Contact</h4>
              <p style={{ fontSize: "13px", color: "#e5e7eb", margin: "0 0 8px" }}>Email: <a href="mailto:hello@orisalign.com" style={{ color: "#C9A84C", textDecoration: "none" }}>hello@orisalign.com</a></p>
              <p style={{ fontSize: "13px", color: "#e5e7eb", margin: "0 0 8px" }}>Phone: +91 80 6217 8511</p>
              <p style={{ fontSize: "13px", color: "#e5e7eb", margin: 0 }}>Bhubaneswar, Odisha, India</p>
            </div>
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "#C9A84C" }}>Follow Us</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li><a href="#" className="footer-link">Instagram</a></li>
                <li><a href="#" className="footer-link">Facebook</a></li>
                <li><a href="#" className="footer-link">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #374151", paddingTop: "20px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>© 2026 Orisalign Private Limited. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  )
}
