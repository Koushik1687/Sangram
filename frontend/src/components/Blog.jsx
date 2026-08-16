import { useCollection } from '../lib/data'

export default function Blog() {
  const blogs = useCollection('blogs')

  return (
    <section id="blog">
      <div className="container">
        <div className="section-head center" data-reveal>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Blog</div>
          <h2>Astrology insights</h2>
          <p>Thoughtful and informative reads on astrology and spiritual life.</p>
        </div>
        <div className="grid-3" id="blogGrid">
          {blogs.map((b) => (
            <article className="blog-card in" key={b.id}>
              <div className="blog-img">✦</div>
              <div className="blog-body">
                <div className="blog-meta"><span>{b.category}</span><span>{b.date}</span></div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
                <a href="#" className="card-link">Read more</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
