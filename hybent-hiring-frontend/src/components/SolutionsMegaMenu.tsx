export default function SolutionsMegaMenu() {
  return (
    <li className="has-mega">
      <a
        className="navlink"
        href="/solutions"
        aria-haspopup="true"
        aria-expanded="false"
        data-nav="solutions services industries hire-talent"
      >
        Solutions <svg className="chev" aria-hidden="true"><use href="#i-chev" /></svg>
      </a>
      <div className="mega mega--sm">
        <div className="mega__grid">
          <div className="mega__item mega__item--linked">
            <a className="mega__item-hit" href="/services" tabIndex={-1} aria-hidden="true"></a>
            <span className="icon-tile"><svg aria-hidden="true"><use href="#i-layers" /></svg></span>
            <span>
              <h5>Services</h5>
              <p>Enterprise IT services, custom software development, web &amp; mobile engineering.</p>
              <span className="mega__acts">
                <a href="/services">Learn more <svg width="13" height="13" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                <a href="/services">Explore services <svg width="13" height="13" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              </span>
            </span>
          </div>
          <div className="mega__item mega__item--linked">
            <a className="mega__item-hit" href="/industries" tabIndex={-1} aria-hidden="true"></a>
            <span className="icon-tile"><svg aria-hidden="true"><use href="#i-brief" /></svg></span>
            <span>
              <h5>Industries</h5>
              <p>Role templates, screening criteria, and scoring rubrics configured by sector.</p>
              <span className="mega__acts">
                <a href="/industries">Learn more <svg width="13" height="13" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                <a href="/industries">See industries <svg width="13" height="13" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              </span>
            </span>
          </div>
          <div className="mega__item mega__item--linked mega__item--full">
            <a className="mega__item-hit" href="/hire-talent" tabIndex={-1} aria-hidden="true"></a>
            <span className="icon-tile"><svg aria-hidden="true"><use href="#i-users" /></svg></span>
            <span>
              <h5>Hire Talent</h5>
              <p>On-demand dedicated software engineering talent and flexible tech staffing.</p>
              <span className="mega__acts">
                <a href="/hire-talent">Learn more <svg width="13" height="13" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                <a href="/hire-talent">Find talent <svg width="13" height="13" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              </span>
            </span>
          </div>
        </div>
        <div className="mega__foot">
          <p className="small">Transforming business operations with intelligent software and top-tier talent.</p>
          <a className="link-arrow" href="/solutions">Explore solutions <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
        </div>
      </div>
    </li>
  );
}
