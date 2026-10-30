import { expenses, totalMonthly } from '../data/expenses';
import './Expenses.css';

function formatCurrency(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

function DonutChart({ items, total }) {
  const size = 200;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-chart">
      {items.map((item) => {
        const pct = item.amount / total;
        const dashLength = pct * circumference;
        const dashOffset = -accumulated * circumference;
        accumulated += pct;

        return (
          <circle
            key={item.id}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="donut-total"
      >
        {formatCurrency(total)}
      </text>
      <text
        x="50%"
        y="58%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="donut-label"
      >
        per month
      </text>
    </svg>
  );
}

export default function Expenses() {
  return (
    <section className="section expenses-section" id="expenses">
      <div className="container">
        <div className="text-center">
          <p className="section-label">Transparency</p>
          <h2 className="section-title">Where Your Donations Go</h2>
          <p className="section-subtitle">
            Every rupee is accounted for. Here is our monthly expense breakdown
            so you can see exactly how your support helps us serve.
          </p>
        </div>

        <div className="expenses-grid">
          <div className="expenses-chart-card">
            <DonutChart items={expenses} total={totalMonthly} />
          </div>

          <div className="expenses-list">
            {expenses.map((item) => {
              const pct = Math.round((item.amount / totalMonthly) * 100);
              return (
                <div className="expense-card" key={item.id}>
                  <div className="expense-icon">{item.icon}</div>
                  <div className="expense-info">
                    <div className="expense-header">
                      <span className="expense-name">{item.label}</span>
                      <span className="expense-amount">{formatCurrency(item.amount)}</span>
                    </div>
                    <p className="expense-desc">{item.description}</p>
                    <div className="expense-bar-track">
                      <div
                        className="expense-bar-fill"
                        style={{ width: `${pct}%`, background: item.color }}
                      />
                    </div>
                  </div>
                  <span className="expense-pct" style={{ color: item.color }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
