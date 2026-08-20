import React from 'react'
import type { ServiceDetail } from '../../data/servicesData'

interface ServiceHeroVisualProps {
  visualType: ServiceDetail['visualType']
  title: string
}

export function ServiceHeroVisual({ visualType, title }: ServiceHeroVisualProps) {
  return (
    <div
      className="card card--flat"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '520px',
        marginInline: 'auto',
        aspectRatio: '16 / 11',
        borderRadius: 'var(--r-xl)',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 253, 0.9))',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 24px 60px -20px rgba(76, 111, 255, 0.18), 0 8px 24px -10px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '0',
      }}
    >
      {/* Top Window Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          background: 'rgba(241, 245, 249, 0.6)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF5F56' }}></span>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFBD2E' }}></span>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27C93F' }}></span>
        </div>
        <span
          style={{
            fontFamily: 'var(--f-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            color: '#64748B',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          hybent://{visualType}.architecture
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontFamily: 'var(--f-mono)',
            color: '#10B981',
            fontWeight: 600,
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981' }}></span>
          LIVE
        </span>
      </div>

      {/* Main Visual Content Canvas */}
      <div
        style={{
          flex: 1,
          padding: '18px 20px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'radial-gradient(ellipse at 80% 20%, rgba(34, 207, 255, 0.08), transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(168, 85, 247, 0.08), transparent 50%)',
        }}
      >
        {/* Render Specific Dynamic SVG Schematics */}
        {renderDiagramByType(visualType, title)}
      </div>
    </div>
  )
}

function renderDiagramByType(type: ServiceDetail['visualType'], title: string) {
  switch (type) {
    case 'marketing-funnel':
      return (
        <div style={{ display: 'grid', gap: '10px', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: '#475569', fontWeight: 600 }}>Multi-Touch Attribution</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--blue)', fontWeight: 700 }}>ROAS 3.84x</span>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              { label: 'Google Search Intent', val: '84%', color: 'var(--cyan)' },
              { label: 'Meta Creative Ingestion', val: '68%', color: 'var(--blue)' },
              { label: 'Server-Side CAPI Grounding', val: '99.4%', color: 'var(--violet)' },
              { label: 'Lead-to-Revenue Closed', val: '38.2%', color: 'var(--success)' },
            ].map((r, i) => (
              <div key={i} style={{ background: 'rgba(255, 255, 255, 0.8)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{r.label}</span>
                  <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: r.color }}>{r.val}</span>
                </div>
                <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: r.val, background: r.color, borderRadius: '4px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )

    case 'ecommerce-checkout':
      return (
        <div style={{ display: 'grid', gap: '10px', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: '#475569', fontWeight: 600 }}>Headless Storefront Stream</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>Latency: 720ms</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(226, 232, 240, 0.9)' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', color: '#64748B' }}>CART CONVERSION</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>4.82%</div>
              <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 600 }}>+34% vs Monolith</span>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(226, 232, 240, 0.9)' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', color: '#64748B' }}>EXPRESS CHECKOUT</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>1-Click</div>
              <span style={{ fontSize: '10px', color: 'var(--cyan)', fontWeight: 600 }}>Apple / Google Pay</span>
            </div>
          </div>
          <div style={{ background: 'rgba(241, 245, 249, 0.7)', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>⚡ Edge Caching (Cloudflare + Vercel)</span>
            <span style={{ fontWeight: 700, color: 'var(--blue)' }}>99.9% Hit Rate</span>
          </div>
        </div>
      )

    case 'ai-agent-mesh':
      return (
        <div style={{ display: 'grid', gap: '8px', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: '#475569', fontWeight: 600 }}>Autonomous Agent Mesh</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--violet)', fontWeight: 700 }}>Precision 99.4%</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {['RAG Retrieval', 'Tool Execution', 'Eval Guardrail'].map((name, i) => (
              <div key={i} style={{ background: 'rgba(255, 255, 255, 0.85)', padding: '8px 6px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--violet)', display: 'inline-block', marginBottom: '4px' }}></span>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#1E293B' }}>{name}</div>
                <div style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: '#64748B' }}>Active</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', fontFamily: 'var(--f-mono)', fontSize: '10px', lineHeight: '1.4' }}>
            <span style={{ color: 'var(--cyan)' }}>$</span> agent.invoke(task: &quot;enterprise_query&quot;)<br />
            <span style={{ color: 'var(--success)' }}>✔</span> Context verified against 100k vector nodes.
          </div>
        </div>
      )

    case 'cloud-kubernetes':
      return (
        <div style={{ display: 'grid', gap: '8px', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: '#475569', fontWeight: 600 }}>Kubernetes Cluster (EKS / GKE)</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--blue)', fontWeight: 700 }}>Uptime 99.99%</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {['ingress-gw', 'api-pod-1', 'api-pod-2', 'worker-pod'].map((pod, i) => (
              <div key={i} style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '8px 4px', borderRadius: '8px', border: '1px solid rgba(76, 111, 255, 0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: '#334155', fontWeight: 600 }}>{pod}</div>
                <div style={{ fontSize: '8px', color: 'var(--success)', fontWeight: 700, marginTop: '2px' }}>RUNNING</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(241, 245, 249, 0.8)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
            <span style={{ color: '#475569' }}>Terraform IaC State: Synced</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: 'var(--blue)' }}>Zero Drift</span>
          </div>
        </div>
      )

    case 'security-shield':
      return (
        <div style={{ display: 'grid', gap: '8px', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: '#475569', fontWeight: 600 }}>Zero-Trust Security Perimeter</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>SOC 2 Certified</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', color: '#64748B' }}>ENCRYPTION</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>AES-256 / TLS 1.3</div>
              <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 600 }}>KMS Auto-Rotation</span>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(76, 111, 255, 0.3)' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', color: '#64748B' }}>IAM AUTH</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Least Privilege</div>
              <span style={{ fontSize: '10px', color: 'var(--blue)', fontWeight: 600 }}>MFA &amp; mTLS</span>
            </div>
          </div>
          <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', fontFamily: 'var(--f-mono)', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Continuous Vulnerability Scan</span>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>0 Critical CVEs</span>
          </div>
        </div>
      )

    case 'data-pipeline':
      return (
        <div style={{ display: 'grid', gap: '8px', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: '#475569', fontWeight: 600 }}>Kafka Event Streaming &amp; ClickHouse</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--cyan)', fontWeight: 700 }}>120k events/sec</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
            {['Producers', 'Kafka Broker', 'Flink Engine', 'ClickHouse'].map((step, i) => (
              <div key={i} style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '6px 4px', borderRadius: '6px', border: '1px solid rgba(34, 207, 255, 0.3)', textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#1E293B' }}>{step}</div>
                <div style={{ fontSize: '8px', fontFamily: 'var(--f-mono)', color: 'var(--blue)' }}>&lt;15ms</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(241, 245, 249, 0.8)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
            <span style={{ color: '#475569' }}>Columnar Compression Ratio</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: 'var(--success)' }}>8.4x Saved</span>
          </div>
        </div>
      )

    default:
      return (
        <div style={{ display: 'grid', gap: '10px', height: '100%', placeContent: 'center', textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--grad)',
              display: 'grid',
              placeItems: 'center',
              marginInline: 'auto',
              boxShadow: '0 8px 24px rgba(76, 111, 255, 0.3)',
              color: '#05060B',
              fontWeight: 800,
              fontSize: '1.4rem',
            }}
          >
            H
          </div>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>{title}</h4>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, fontFamily: 'var(--f-mono)' }}>
              Enterprise Architecture &amp; Execution
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', padding: '3px 8px', borderRadius: '20px', background: '#F1F5F9', color: '#334155', fontWeight: 600 }}>
              SLA 99.9%
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', padding: '3px 8px', borderRadius: '20px', background: '#F1F5F9', color: '#334155', fontWeight: 600 }}>
              SOC 2 Ready
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', padding: '3px 8px', borderRadius: '20px', background: '#F1F5F9', color: '#334155', fontWeight: 600 }}>
              100% IP Owned
            </span>
          </div>
        </div>
      )
  }
}
