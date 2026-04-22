import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { PageHeader } from '../components/PageHeader'

function prettyJson(value) {
  if (value == null) return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function formatLogLevel(value) {
  const labels = {
    INFO: '안내',
    WARN: '주의',
    ERROR: '오류',
  }
  return labels[value] ?? value ?? '-'
}

function formatLogStep(value) {
  const labels = {
    REQUEST: '요청 확인',
    VALIDATION: '입력 확인',
    REQUEST_BUILD: '전송 준비',
    EXTERNAL_CALL: '외부 전송',
    RESPONSE_PARSE: '응답 확인',
    RESULT_SAVE: '결과 저장',
    RETRY: '다시 실행',
    ERROR: '오류 확인',
  }
  return labels[value] ?? value ?? '-'
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function LogsPage() {
  const [interfaceId, setInterfaceId] = useState('')
  const [executionId, setExecutionId] = useState('')
  const [page, setPage] = useState(0)
  const [selectedExecutionId, setSelectedExecutionId] = useState('')

  const logsQuery = useQuery({
    queryKey: ['logs', interfaceId, executionId, page],
    queryFn: () =>
      apiGet('/api/logs', {
        params: {
          interfaceId: interfaceId || undefined,
          executionId: executionId || undefined,
          page,
          size: 10,
        },
      }),
  })

  const selectedId = selectedExecutionId || executionId

  const detailQuery = useQuery({
    queryKey: ['log-detail', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiGet(`/api/logs/${selectedId}`),
  })

  const payloadQuery = useQuery({
    queryKey: ['log-payload', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiGet(`/api/logs/${selectedId}/payload`),
  })

  const logs = logsQuery.data ?? { content: [], totalElements: 0, totalPages: 0 }
  const detailLogs = detailQuery.data ?? []
  const payload = payloadQuery.data ?? null

  const selectedTitle = useMemo(() => {
    if (!selectedId) return '선택 없음'
    return `실행 번호 ${selectedId}`
  }, [selectedId])

  return (
    <div className="page-stack">
      <PageHeader
        title="처리 기록"
        description="실행한 내용과 주고받은 내용을 확인하는 화면입니다."
      />

      <section className="panel">
        <div className="toolbar">
          <input
            className="text-input"
            placeholder="연동 번호"
            value={interfaceId}
            onChange={(event) => setInterfaceId(event.target.value)}
          />
          <input
            className="text-input"
            placeholder="실행 번호"
            value={executionId}
            onChange={(event) => setExecutionId(event.target.value)}
          />
          <button className="secondary-button" type="button" onClick={() => setPage(0)}>
            조회
          </button>
        </div>

        <div className="split-layout logs-layout">
          <div className="table-card">
            <table className="logs-table">
              <colgroup>
                <col className="logs-col-id" />
                <col className="logs-col-interface" />
                <col className="logs-col-step" />
                <col className="logs-col-level" />
                <col className="logs-col-time" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>실행 번호</th>
                  <th>연동 이름</th>
                  <th>단계</th>
                  <th>구분</th>
                  <th>기록 시각</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {logs.content.length > 0 ? (
                  logs.content.map((row) => (
                    <tr
                      key={row.logId}
                      className={row.executionId === Number(selectedId) ? 'selected-row' : ''}
                      onClick={() => setSelectedExecutionId(String(row.executionId))}
                    >
                      <td>{row.executionId}</td>
                      <td>{row.interfaceName}</td>
                      <td>{formatLogStep(row.stepName)}</td>
                      <td>{formatLogLevel(row.logLevel)}</td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.message}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      아직 기록된 내용이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="pagination-bar">
              <span>{logs.totalElements ?? 0}건</span>
              <div className="pagination-actions">
                <button className="ghost-button" type="button" disabled={page <= 0} onClick={() => setPage((prev) => Math.max(prev - 1, 0))}>
                  이전
                </button>
                <span>
                  {page + 1} / {Math.max(logs.totalPages || 1, 1)}
                </span>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={page + 1 >= (logs.totalPages || 1)}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </div>

          <div className="stacked-panels">
            <div className="panel form-panel">
              <div className="panel-heading">
                <h3>처리 흐름</h3>
                <span>{selectedTitle}</span>
              </div>

              {detailLogs.length > 0 ? (
                <div className="mini-list">
                  {detailLogs.map((log) => (
                    <div key={`${log.stepName}-${log.createdAt}`} className="mini-list-item">
                      <strong>{log.stepName}</strong>
                      <span>
                        {formatLogLevel(log.logLevel)} · {formatDateTime(log.createdAt)}
                      </span>
                      <small>{log.message}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">실행 건을 선택하면 단계별 흐름을 볼 수 있어요.</div>
              )}
            </div>

            <div className="panel form-panel">
              <div className="panel-heading">
                <h3>전송 / 응답 내용</h3>
                <span>{selectedTitle}</span>
              </div>

              {payload ? (
                <div className="detail-grid">
                  <div>
                    <span>보낸 내용</span>
                    <pre className="payload-pre">{prettyJson(payload.requestBody)}</pre>
                  </div>
                  <div>
                    <span>받은 내용</span>
                    <pre className="payload-pre">{prettyJson(payload.responseBody)}</pre>
                  </div>
                  <div>
                    <span>응답 상태</span>
                    <strong>{payload.responseStatusCode ?? '-'}</strong>
                  </div>
                  <div>
                    <span>오류 내용</span>
                    <div className="payload-value">{payload.errorMessage ?? '-'}</div>
                  </div>
                  <div>
                    <span>시작 시각</span>
                    <strong>{formatDateTime(payload.startedAt)}</strong>
                  </div>
                  <div>
                    <span>종료 시각</span>
                    <strong>{formatDateTime(payload.endedAt)}</strong>
                  </div>
                </div>
              ) : (
                <div className="empty-state">실행 번호를 선택하면 보낸 내용과 받은 내용을 볼 수 있어요.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
