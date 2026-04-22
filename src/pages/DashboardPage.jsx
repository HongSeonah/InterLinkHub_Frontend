import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(value ?? 0)
}

function formatExecutionStatus(value) {
  const labels = {
    PENDING: '대기',
    RUNNING: '진행 중',
    SUCCESS: '성공',
    FAILED: '실패',
    TIMEOUT: '시간 초과',
    CANCELLED: '취소됨',
    RETRYING: '재실행 중',
  }
  return labels[value] ?? value ?? '-'
}

function clampPercent(value, maxValue) {
  if (!maxValue) return 0
  return Math.max(8, Math.min(100, Math.round((value / maxValue) * 100)))
}

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiGet('/api/dashboard/summary'),
  })

  const failureQuery = useQuery({
    queryKey: ['dashboard-failures'],
    queryFn: () => apiGet('/api/dashboard/failures?limit=5'),
  })

  const summary = summaryQuery.data ?? {}
  const failures = failureQuery.data ?? []
  const averageLatency = Number(summary.averageLatencyMillis ?? 0)
  const maxLatency = Number(summary.maxLatencyMillis ?? 0)
  const timeoutCount = Number(summary.todayTimeoutCount ?? 0)
  const latencyPeak = Math.max(averageLatency, maxLatency, timeoutCount, 1)

  return (
    <div className="page-stack">
      <PageHeader
        title="업무 현황"
        description="현재 등록된 정보와 오늘 처리 결과를 한눈에 볼 수 있는 첫 화면입니다."
      />

      <section className="stats-grid">
        <StatCard label="등록 수" value={formatNumber(summary.totalInterfaceCount)} hint="전체 개수" />
        <StatCard label="가동 중" value={formatNumber(summary.activeInterfaceCount)} tone="mint" />
        <StatCard label="오늘 실행" value={formatNumber(summary.todayExecutionCount)} tone="gold" />
        <StatCard label="실패 건수" value={formatNumber(summary.todayFailureCount)} tone="rose" />
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-heading">
            <h3>처리 시간</h3>
            <span>ms</span>
          </div>
          <div className="metric-row">
            <div>
              <p>평균</p>
              <strong>{formatNumber(summary.averageLatencyMillis)}</strong>
            </div>
            <div>
              <p>최대</p>
              <strong>{formatNumber(summary.maxLatencyMillis)}</strong>
            </div>
            <div>
              <p>시간 초과</p>
              <strong>{formatNumber(summary.todayTimeoutCount)}</strong>
            </div>
          </div>
          <div className="latency-visual" aria-hidden="true">
            <div className="latency-bars">
              <div className="latency-bar-group">
                <span className="latency-bar-label">평균</span>
                <div className="latency-bar-track">
                  <div className="latency-bar" style={{ height: `${clampPercent(averageLatency, latencyPeak)}%` }} />
                </div>
              </div>
              <div className="latency-bar-group">
                <span className="latency-bar-label">최대</span>
                <div className="latency-bar-track">
                  <div className="latency-bar" style={{ height: `${clampPercent(maxLatency, latencyPeak)}%` }} />
                </div>
              </div>
              <div className="latency-bar-group">
                <span className="latency-bar-label">초과</span>
                <div className="latency-bar-track">
                  <div className="latency-bar latency-bar-alert" style={{ height: `${clampPercent(timeoutCount, latencyPeak)}%` }} />
                </div>
              </div>
            </div>
            <div className="latency-note">
              오늘 처리 시간의 상대적인 흐름을 보여줍니다.
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h3>최근 실패 내역</h3>
            <span>최근 5건</span>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>연동</th>
                  <th>상태</th>
                  <th>오류 내용</th>
                </tr>
              </thead>
              <tbody>
                {failures.length > 0 ? (
                  failures.map((row) => (
                    <tr key={row.executionId}>
                      <td>{row.interfaceName}</td>
                      <td>{formatExecutionStatus(row.executionStatus)}</td>
                      <td>{row.errorMessage}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="empty-state">
                      아직 실패한 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  )
}
