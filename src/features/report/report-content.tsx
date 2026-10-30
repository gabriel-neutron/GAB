import { useReportScroll, reportAddress, type OpenReportNode } from './report-context';
import { itemAt } from './model';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useInView, useScroll, useTransform } from 'motion/react';
import { report, basins, caps, media, secondMedia } from './content';

import { Citation } from './citations';
import { NodeLink, PriceFigure, PortMap, EvidenceGraph } from './figures';

function Entity({ onOpen }: { onOpen: OpenReportNode }) {
  return <NodeLink id="N-P026" onOpen={onOpen} />;
}

function ContextImage({ compact = false, source = media }) {
  const [ready, setReady] = useState(false);
  const frameRef = useRef<HTMLElement>(null);
  const container = useReportScroll();
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    container,
    target: frameRef,
    offset: ['start end', 'end start'],
  });
  const photoY = useTransform(scrollYProgress, [0, 1], ['-4%', '4%']);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    let cancelled = false;
    const draw = () => {
      if (cancelled || !canvas.current) return;
      const c = canvas.current;
      const box = c.parentElement?.getBoundingClientRect();
      if (!box || box.width < 1 || box.height < 1) return;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(box.width * density);
      c.height = Math.round(box.height * density);
      const ctx = c.getContext('2d');
      if (ctx === null) return;
      const scale = Math.max(c.width / img.width, c.height / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      ctx.drawImage(img, (c.width - width) / 2, (c.height - height) * 0.65, width, height);
      const frame = ctx.getImageData(0, 0, c.width, c.height);
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const p = (y * c.width + x) * 4;
          const l =
            0.2126 * itemAt(frame.data, p) +
            0.7152 * itemAt(frame.data, p + 1) +
            0.0722 * itemAt(frame.data, p + 2);
          const v =
            (l - 125) * 1.35 + 125 > (itemAt(bayer, (y % 4) * 4 + (x % 4)) + 0.5) * 16 ? 238 : 16;
          frame.data[p] = frame.data[p + 1] = frame.data[p + 2] = v;
        }
      ctx.putImageData(frame, 0, 0);
      c.dataset['rendered'] = 'true';
      setReady(true);
    };
    const observer = new ResizeObserver(() => {
      if (img.complete && img.naturalWidth) draw();
    });
    img.onload = () => {
      if (cancelled || !canvas.current) return;
      draw();
      if (canvas.current.parentElement) observer.observe(canvas.current.parentElement);
    };
    img.src = source.src;
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [source.src]);
  return (
    <figure ref={frameRef} className={`context-image ${compact ? 'compact' : ''}`}>
      <div className="image-stage">
        <motion.div
          className="photo-plane"
          style={{ y: reduce ? 0 : photoY, scale: reduce ? 1 : 1.1 }}
        >
          <img
            src={source.src.replace('.jpg', '-dither.png')}
            alt={source.alt}
            width="1920"
            height="1395"
            className="mono-photo"
          />
          <canvas ref={canvas} aria-hidden="true" style={{ display: ready ? 'block' : 'none' }} />
        </motion.div>
      </div>
      <figcaption>
        <span>
          {source.caption}
          <br />
          <a href={source.href}>{source.credit}</a>
        </span>
      </figcaption>
    </figure>
  );
}

function Chart({ title = true }) {
  const [product, setProduct] = useState<'crude' | 'products'>('crude');
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const entered = useInView(ref, { once: true, amount: 0.25 });
  return (
    <figure ref={ref} className={`flow-chart ${entered ? 'figure-entered' : ''}`} id="figure-7a">
      <figcaption>
        {title && <h3>Where oil leaves by sea</h3>}
        <p className="meta">
          Figure 7A · Seaborne loading basins · January 2026 <Citation id={2} />
        </p>
      </figcaption>
      <div className="chart-toolbar">
        <div className="segmented" role="group" aria-label="Petroleum product">
          <button aria-pressed={product === 'crude'} onClick={() => setProduct('crude')}>
            Crude oil
          </button>
          <button aria-pressed={product === 'products'} onClick={() => setProduct('products')}>
            Oil products
          </button>
        </div>
        <span className="unit">Thousand barrels / day</span>
      </div>
      <div className="chart-axis" aria-hidden="true">
        <span>0</span>
        <span>800</span>
        <span>1,600</span>
      </div>
      <div className="bars" aria-live="polite">
        {basins.map((row, i) => (
          <div className="bar-row" key={row.name}>
            <div className="bar-label">
              <span>{row.name}</span>
              <span className="data">{row[product].toLocaleString('en-US')}</span>
            </div>
            <div className="bar-track">
              <motion.div
                className={`bar ${i === 0 ? 'highlight' : ''}`}
                initial={false}
                animate={{ scaleX: row[product] / 1600 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="chart-note">
        Loading basins only. These values do not establish which fleet delivered oil to which buyer.
      </p>
      <details>
        <summary>Read the data table</summary>
        <table>
          <caption>January 2026 · thousand barrels per day</caption>
          <thead>
            <tr>
              <th>Basin</th>
              <th>Crude</th>
              <th>Products</th>
            </tr>
          </thead>
          <tbody>
            {basins.map((r) => (
              <tr key={r.name}>
                <th>{r.name}</th>
                <td>{r.crude.toLocaleString('en-US')}</td>
                <td>{r.products.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function CapSequence() {
  const [selected, setSelected] = useState(2);
  const reduce = useReducedMotion();
  return (
    <div className="cap-sequence">
      <h3>The cap changes</h3>
      <p className="meta">EU price cap · US dollars per barrel</p>
      <div className="cap-instrument" aria-hidden="true">
        <div className="cap-readout">
          ${itemAt(caps, selected).value}
          <span>/ barrel</span>
        </div>
        <svg viewBox="0 0 400 170">
          {Array.from({ length: 13 }, (_, i) => (
            <g key={i}>
              <line
                x1={20 + i * 30}
                x2={20 + i * 30}
                y1="80"
                y2={i % 2 === 0 ? 104 : 94}
                stroke="currentColor"
                opacity=".45"
              />
              {i % 2 === 0 && (
                <text x={20 + i * 30} y="127" textAnchor="middle" fill="currentColor" fontSize="12">
                  {i * 5}
                </text>
              )}
            </g>
          ))}
          <motion.g
            initial={false}
            animate={{ x: 20 + Number(itemAt(caps, selected).value) * 6 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          >
            <path d="M-7 60 L7 60 L0 70 Z" fill="var(--signal)" />
            <line y1="72" y2="105" stroke="var(--signal)" strokeWidth="2" />
          </motion.g>
        </svg>
      </div>
      <div className="cap-steps" role="group" aria-label="Price cap dates">
        {caps.map((c, i) => (
          <button key={c.date} onClick={() => setSelected(i)} aria-pressed={selected === i}>
            <span className="data">{c.date}</span>
            <span className="cap-value">${c.value}</span>
          </button>
        ))}
      </div>
      <p className="cap-detail" aria-live="polite">
        {itemAt(caps, selected).note}. <Citation id={selected + 5} />
      </p>
      <p className="chart-note">
        Applies to maritime services for Russian crude (transport, insurance, financing,
        brokering) by coalition operators. The cap is a contractual threshold, not the observed
        Urals tax-reference price. Last act checked: Implementing Regulation (EU) 2026/124.
      </p>
    </div>
  );
}

const chapters: readonly (readonly [string, string])[] = [
  ['overview', 'Overview'],
  ['sea', 'Oil at sea'],
  ['geography', 'Export geography'],
  ['price', 'The price of access'],
  ['network', 'Relationships'],
  ['limits', 'Limits'],
];
function ReadingNav() {
  const container = useReportScroll();
  const [active, setActive] = useState('overview');
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const update = () => {
      let current = 'overview';
      for (const [id] of chapters) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 180) current = id;
      }
      setActive(current);
    };
    const el = container.current;
    el?.addEventListener('scroll', update, { passive: true });
    update();
    return () => el?.removeEventListener('scroll', update);
  }, [container]);
  return (
    <details
      className="compact-index"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (ref.current) ref.current.open = false;
          ref.current?.querySelector('summary')?.focus();
        }
      }}
    >
      <summary>
        <svg className="index-symbol" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 4h12M2 8h8M2 12h12" fill="none" stroke="currentColor" strokeWidth="1.25" />
        </svg>{' '}
        <span className="index-current">{chapters.find((c) => c[0] === active)?.[1]}</span>
        <span className="index-toggle" aria-hidden="true">
          +
        </span>
      </summary>
      <nav aria-label="Reading guide">
        {chapters.map(([id, label], i) => (
          <a
            key={id}
            href={'#' + id}
            aria-current={active === id ? 'location' : undefined}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
          >
            <span className="data">{String(i + 1).padStart(2, '0')}</span>
            {label}
            <span>↘</span>
          </a>
        ))}
      </nav>
    </details>
  );
}

function SeaCopy({ onOpen }: { onOpen: OpenReportNode }) {
  return (
    <div className="prose">
      <p>
        Crude oil that does not leave Russia by pipeline passes through a small number of ports:{' '}
        <NodeLink id="N-P001" onOpen={onOpen} /> and <NodeLink id="N-P002" onOpen={onOpen} /> on the
        Baltic, <NodeLink id="N-P005" onOpen={onOpen} /> on the Black Sea, and{' '}
        <NodeLink id="N-P007" onOpen={onOpen} /> on the Pacific.
        <Citation id={10} />
      </p>
      <p>
        {report.sea[1]}
        <Citation id={1} />
      </p>
      <p>
        {report.sea[2]}
        <Citation id={1} />
      </p>
    </div>
  );
}
function PriceCopy({ onOpen }: { onOpen: OpenReportNode }) {
  return (
    <div className="prose">
      <p>
        The Urals discount widened after the October 2025 US designations of{' '}
        <Entity onOpen={onOpen} /> and <NodeLink id="N-P030" onOpen={onOpen} />. The report
        considers a sanctions effect plausible, but the timing alone cannot establish causation.
        <Citation id={8} />
      </p>
      <p>
        {report.price[1]}
        <Citation id={9} />
      </p>
      <p>
        {report.price[2]}
        <Citation id={4} />
      </p>
    </div>
  );
}
function FleetPlate() {
  const reduce = useReducedMotion();
  return (
    <figure className="fleet-plate">
      <figcaption>
        <h3>The shadow fleet</h3>
        <p className="meta">
          Seaborne crude · January 2026 <Citation id={1} />
        </p>
      </figcaption>
      <div className="fleet-total">
        <span>
          79<span>%</span>
        </span>
        <p>
          of Russian seaborne crude.
          <br />A classification, not a sanctions list.
        </p>
      </div>
      <div
        className="fleet-cells"
        role="img"
        aria-label="79 highlighted cells out of 100 represent the shadow fleet share of Russian seaborne crude exports"
      >
        <motion.div
          className="cell-field"
          initial={false}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          {Array.from({ length: 100 }, (_, i) => (
            <motion.span
              key={i}
              className={i < 79 ? 'filled' : ''}
              initial={false}
              whileInView={reduce ? {} : { scale: [0.35, 1], opacity: [0.25, 1] }}
              viewport={{ once: true }}
              transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : (i % 20) * 0.012 }}
            />
          ))}
        </motion.div>
      </div>
      <p className="fleet-explanation">
        Each cell represents one percentage point of export volume, not one ship. KSE classifies the
        shadow fleet using flag and insurance.
      </p>
    </figure>
  );
}

export function Journal({ onOpen }: { onOpen: OpenReportNode }) {
  return (
    <>
      <ReadingNav />
      <section className="journal-cover">
        <h1>
          Russia’s war
          <br />
          <span>economy</span>
        </h1>
        <div className="cover-line">
          <p className="subtitle">{report.subtitle}</p>
          <a href="#overview" className="primary">
            Read the report <span>↓</span>
          </a>
        </div>
        <div className="contact-sheet">
          <div className="contact-main">
            <ContextImage compact />
          </div>
          <div className="contact-detail">
            <ContextImage source={secondMedia} />
          </div>
        </div>
        <p className="cover-caption">
          Oil, money and imported components. Following the infrastructure that sustains Russia’s
          war.
        </p>
      </section>
      <section className="section journal-overview" id="overview">
        <h2>Adaptation has a cost.</h2>
        <div className="overview-columns">
          <p>{report.summary}</p>
          <p>
            The full report follows three functions: earning revenue, moving money and obtaining
            components. This extract follows oil, from the infrastructure that moves it to the price
            Russia receives.
          </p>
        </div>
      </section>
      <section className="section journal-sea" id="sea">
        <header className="chapter-heading">
          <div>
            <h2>Oil keeps moving</h2>
          </div>
        </header>
        <SeaCopy onOpen={onOpen} />
        <div className="figure-diptych">
          <Chart />
          <PortMap onOpen={onOpen} />
        </div>
        <FleetPlate />
      </section>
      <section className="image-interlude" aria-labelledby="material-title">
        <div className="interlude-title">
          <h2 id="material-title">The machinery of trade</h2>
          <p>Ships, ports and insurance turn a commodity into revenue.</p>
        </div>
        <ContextImage source={secondMedia} compact />
        <p className="chart-note">
          Context photography: Eagle San Diego, 30 December 2024. No connection to the shadow fleet
          is asserted.
        </p>
      </section>
      <section className="section journal-price" id="price">
        <header className="chapter-heading">
          <div>
            <h2>The price of access</h2>
          </div>
        </header>
        <PriceFigure />
        <div className="price-spread">
          <div>
            <PriceCopy onOpen={onOpen} />
          </div>
          <CapSequence />
        </div>
      </section>
      <section className="section network-section" id="network">
        <header className="chapter-heading">
          <div>
            <h2>Follow the relationships</h2>
          </div>
        </header>
        <p>
          Ownership, operation and designation answer different questions. Select a node to read its
          immediate relations, then open the same record used by the text and map.
        </p>
        <EvidenceGraph onOpen={onOpen} />
      </section>
    </>
  );
}

export function EndMatter() {
  return (
    <section className="section limits" id="limits">
      <h2>What we cannot infer</h2>
      <div>
        <p>
          Keeping oil moving is not the same as preserving revenue. The graphs describe specific
          quantities and documented relationships; they do not establish causation.
        </p>
        <p>{report.limit}</p>
      </div>
      <a className="source-link" href={reportAddress('bibliography')}>
        Bibliography & source data ↗
      </a>
    </section>
  );
}
