import Link from "next/link";
import { connection } from "next/server";
import { getPublishedStories } from "@/lib/catalog";

export default async function Home() {
  await connection();
  const featuredStories = (await getPublishedStories()).slice(0, 3);

  return (
    <section>
    <section id="home" className="screen active">
 
  <div className="hero">
    <div className="hero-sky">
      <div className="hero-sun"></div>
      <div className="dust-field" id="dust-field"></div>
      <div className="hero-trees">
        <svg viewBox="0 0 1200 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,160 L0,120 Q30,118 40,100 Q46,90 40,80 Q52,84 56,70 Q60,84 70,82 Q66,100 80,110 Q70,120 90,124 L90,160 Z" fill="#100E17"/>
          <path d="M180,160 L180,110 Q205,108 212,92 Q216,84 210,76 Q222,80 226,66 Q230,80 240,78 Q236,96 250,104 Q240,112 258,118 L258,160 Z" fill="#100E17" opacity="0.9"/>
          <path d="M980,160 L980,115 Q1002,112 1008,98 Q1012,90 1006,82 Q1017,86 1021,74 Q1024,86 1033,84 Q1030,100 1042,108 Q1033,114 1049,120 L1049,160 Z" fill="#100E17" opacity="0.9"/>
          <path d="M1120,160 L1120,125 Q1140,123 1146,110 Q1150,102 1145,95 Q1154,98 1158,87 Q1161,98 1169,96 Q1166,110 1176,116 Q1169,122 1182,127 L1182,160 Z" fill="#100E17"/>
          <rect x="0" y="150" width="1200" height="10" fill="#100E17"/>
        </svg>
      </div>
    </div>
    <div className="hero-weave-wrap"><div className="weave"></div></div>
 
    <div className="hero-copy">
      <div className="eyebrow">Northern Ghana history, told in full</div>
      <h1>Where the harmattan wind still carries the old stories home</h1>
      <p className="lede">Every dry season, elders across Lawra, Wa,
        and the Dagbon towns sit down with our 
        recorders and tell the stories that don&apos;t make it into
        textbooks how kingships moved, why festivals started, what one visit from a president meant to a town far from the capital. We&apos;re setting all of it down, chapter by chapter.</p>
      <div className="hero-actions">
        <Link href="/catalog" className="cta">Start reading | first chapter free</Link>
        <a href="#how-it-works" className="link-cta">See how it works</a>
      </div>
      <div id="continue-reading" className="continue-reading" hidden>
        <div>
          <span className="continue-label">Continue reading</span>
          <strong>The Royal Line of Lawra</strong>
          <span>Page 2 · Memory in motion</span>
        </div>
        <button className="ghost" type="button" data-continue-reading>Continue</button>
      </div>
    </div>
  </div>
 
  <div className="shell">
 
    <div className="section" id="featured">
      <div className="section-head">
        <h2>From the collection</h2>
        <Link href="/catalog" className="link-cta">See all stories</Link>
      </div>
      <ul className="toc">
        {featuredStories.map((story) => (
          <li key={story.id}>
            <div className="book">
              <div className="free-note">First pages free</div>
              <h3><Link href={`/books/${story.slug}`} className="open-book">{story.title}</Link></h3>
              <p className="teaser">{story.summary || story.description || 'Read this story from the Northern Heritage Library.'}</p>
              <div className="meta">{story.pages} pages<span className="price">GHS {story.price.toFixed(2)} full story</span></div>
            </div>
          </li>
        ))}
        {!featuredStories.length ? <li><p className="text-muted">New stories are being prepared for the library.</p></li> : null}
      </ul>
    </div>
 
    <div className="section" id="how-it-works">
      <div className="section-head"><h2>How reading works</h2></div>
      <ol className="steps">
        <li>
          <span className="num">1</span>
          <h3>Read the first chapter free</h3>
          <p>Every book opens with its first chapter unlocked, no account or payment needed, so you know what you&apos;re paying for before you pay for it.</p>
        </li>
        <li>
          <span className="num">2</span>
          <h3>Unlock pages as you go</h3>
          <p>Each extra page costs GHS 1.00 and is paid securely through PayStack, with no surprise subscription charge.</p>
        </li>
        <li>
          <span className="num">3</span>
          <h3>Top up whenever you like</h3>
          <p>Add funds by mobile money in seconds. Your balance carries across every book in the collection.</p>
        </li>
      </ol>
    </div>
 
    <div className="quote-block">
      <div className="weave quiet"></div>
      <blockquote>
        &quot;My grandchildren know the songs but not why we sing them. I am telling this so the why doesn&apos;t end with me.&quot;
      </blockquote>
      <div className="quote-attr">— an elder from Lawra, recorded for The Story Behind Kobine Festival</div>
    </div>
 
    <div className="home-cta-band">
      <h2>Stories from Northern Ghana, one page at a time, no subscription to forget about.</h2>
      <Link href="/catalog" className="cta">Browse the library</Link>
    </div>
 
  </div>
</section>
   </section>
  )
}