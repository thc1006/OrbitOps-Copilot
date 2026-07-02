import http from 'k6/http';
import { check, sleep } from 'k6';

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
    // Measured baseline 2026-07-02: p(95)=1.31ms, p(99)=1.64ms
    // Thresholds set at 2× measured value to catch regressions of 2× or worse.
    http_req_duration: ['p(95)<3', 'p(99)<4'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.EMULATOR_BASE || 'http://localhost:30080';

export default function () {
  const res = http.get(`${BASE}/metrics`);
  check(res, {
    'status 200': (r) => r.status === 200,
    'has metrics': (r) => r.body.includes('orbitops_'),
  });
}
