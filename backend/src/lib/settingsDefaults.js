const DEFAULTS = {
  inactive_days: 30,
  vip_spend_centavos: 5000000,
  vip_visits: 12,
  vip_visit_window_days: 365,
  frequent_visits: 3,
  frequent_window_days: 30,
  loyal_visits: 6,
  loyal_window_days: 180,
  loyal_recent_days: 60,
  regular_visits: 2,
  regular_window_days: 90,
  new_customer_days: 30,
  slow_moving_units: 2,
  slow_moving_window_days: 30,
  dead_stock_window_days: 60,
  large_transaction_centavos: 1500000,
  excessive_discount_percent: 20,
  spike_multiplier: 2,
  spike_baseline_days: 28,
  declining_sales_percent: 25,
  days_of_cover_threshold: 7,
  sales_rate_window_days: 14,
  void_repeat_count: 3,
  void_repeat_window_hours: 24,
  purchase_count_threshold: 3,
}

const SETTING_KEYS = Object.keys(DEFAULTS)

function criteriaFromSettings(settings) {
  return {
    VIP: {
      description: 'High historical spending or high visit frequency.',
      criteria: {
        match: 'any',
        rules: [
          { field: 'total_spent_centavos', op: 'gte', value: settings.vip_spend_centavos },
          { field: 'visit_count_in_days', op: 'gte', value: settings.vip_visits, windowDays: settings.vip_visit_window_days },
        ],
      },
    },
    Loyal: {
      description: 'Repeat visits in the last 180 days and a recent visit.',
      criteria: {
        match: 'all',
        rules: [
          { field: 'visit_count_in_days', op: 'gte', value: settings.loyal_visits, windowDays: settings.loyal_window_days },
          { field: 'days_since_last_visit', op: 'lte', value: settings.loyal_recent_days },
        ],
      },
    },
    Frequent: {
      description: 'Several visits inside a short window.',
      criteria: {
        match: 'all',
        rules: [{ field: 'visit_count_in_days', op: 'gte', value: settings.frequent_visits, windowDays: settings.frequent_window_days }],
      },
    },
    Regular: {
      description: 'A steady visit pattern.',
      criteria: {
        match: 'all',
        rules: [{ field: 'visit_count_in_days', op: 'gte', value: settings.regular_visits, windowDays: settings.regular_window_days }],
      },
    },
    New: {
      description: 'First completed order is recent.',
      criteria: {
        match: 'all',
        rules: [{ field: 'days_since_first_visit', op: 'lte', value: settings.new_customer_days }],
      },
    },
    Inactive: {
      description: 'No completed purchase inside the configured number of days.',
      criteria: {
        match: 'all',
        rules: [{ field: 'days_since_last_visit', op: 'gte', value: settings.inactive_days }],
      },
    },
  }
}

module.exports = { DEFAULTS, SETTING_KEYS, criteriaFromSettings }
