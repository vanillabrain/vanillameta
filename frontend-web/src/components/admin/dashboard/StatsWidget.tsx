import React from 'react';
import './StatsWidget.css';

interface StatsWidgetProps {
  title: string;
  value: number | string;
  icon: string;
  color?: string;
  subtitle?: string;
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
}

const StatsWidget: React.FC<StatsWidgetProps> = ({ title, value, icon, color = '#3498db', subtitle, change }) => {
  return (
    <div className="stats-widget" style={{ borderLeftColor: color }}>
      <div className="widget-header">
        <div className="widget-icon" style={{ color }}>
          {icon}
        </div>
        <div className="widget-info">
          <h4 className="widget-title">{title}</h4>
          <div className="widget-value">{value.toLocaleString()}</div>
        </div>
      </div>

      {subtitle && <div className="widget-subtitle">{subtitle}</div>}

      {change && (
        <div className={`widget-change ${change.trend}`}>
          <span className="change-icon">{change.trend === 'up' ? '📈' : '📉'}</span>
          <span className="change-value">
            {change.trend === 'up' ? '+' : ''}
            {change.value}%
          </span>
          <span className="change-label">vs 지난주</span>
        </div>
      )}
    </div>
  );
};

export default StatsWidget;
