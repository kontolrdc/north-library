import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="weave"></div>

      <div className="footer-shell">
        <div className="footer-grid">
          <div className="footer-col">
            <h3>Our mission</h3>
            <p>
              We preserve and share the oral histories of Northern Ghana, so that the stories of our communities are never lost.
            </p>
          </div>
          <div className="footer-col">
            <h3>Our vision</h3>
            <p>
              To be the leading platform for preserving and sharing the rich cultural heritage of Northern Ghana, so future generations can learn from the stories of their ancestors.
            </p>
          </div>
          <div className="footer-col">
            <h3>Contact us</h3>
            <p>
              <a href="mailto:kontolrdc@gmail.com">kontolrdc@gmail.com</a>
            </p>
            <p>0541715807</p>
          </div>
        </div>
      </div>

      <div className="footer-bar">
        <span>Northern Heritage Library</span>
        <span>Recorded across Ghana&apos;s Upper West and Northern regions</span>
      </div>
    </footer>
  );
}