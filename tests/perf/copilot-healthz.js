import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    constant_100rps: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: {
    // Measured baseline 2026-07-02: p(95)=1.88ms, p(99)=3.76ms
    // Thresholds set at 2× measured value to catch regressions of 2× or worse.
    http_req_duration: ['p(95)<4', 'p(99)<8'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.COPILOT_BASE || 'http://localhost:30081';

export default function () {
  const res = http.get(`${BASE}/healthz`);
  check(res, {
    'status 200': (r) => r.status === 200,
    'ok': (r) => r.json('status') === 'ok',
  });
}
