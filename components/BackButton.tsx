export default function BackButton() {
  return (
    <>
      <style>{`
        .back-btn {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid #b8905a;
          background: white;
          color: #b8905a;
          text-decoration: none;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          letter-spacing: 0.3px;
          transition: all 0.2s ease;
          margin-bottom: 20px;
        }
        .back-btn:hover {
          background: #b8905a;
          color: white;
        }
      `}</style>
      <a href="/" className="back-btn">← Home</a>
    </>
  )
}
