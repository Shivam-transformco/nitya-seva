export const expenses = [
  {
    id: 'rent',
    label: 'Base Rent',
    amount: 75000,
    color: '#c4710e',
    icon: '🏠',
    description: 'Monthly rent for our student center space',
  },
  {
    id: 'electricity',
    label: 'Electricity',
    amount: 26000,
    color: '#e8950f',
    icon: '⚡',
    description: 'Power supply for daily activities and events',
  },
  {
    id: 'maintenance',
    label: 'Base Maintenance',
    amount: 20000,
    color: '#d4a056',
    icon: '🔧',
    description: 'Upkeep and maintenance of the premises',
  },
  {
    id: 'preaching',
    label: 'Preaching Expenses',
    amount: 20000,
    color: '#a86b2d',
    icon: '📖',
    description: 'Materials and logistics for spiritual outreach',
  },
];

export const totalMonthly = expenses.reduce((sum, e) => sum + e.amount, 0);
