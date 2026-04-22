import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../lib/api'
import { PageHeader } from '../components/PageHeader'

const executionDefaults = {
  interfaceId: '',
  requestedBy: 'operator1',
  traceId: '',
  requestBody: '{\n  "customerName": "홍길동",\n  "productCode": "INS-001"\n}',
}

const scenarioPresets = {
  NORMAL: {
    label: '정상 실행',
    requestedBy: 'operator1',
    traceId: 'TRACE-NORMAL-001',
    requestBody: '{\n  "customerName": "홍길동",\n  "productCode": "INS-001"\n}',
  },
  FAILURE: {
    label: '실패 실행',
    requestedBy: 'operator1',
    traceId: 'TRACE-FAIL-001',
    requestBody: '{\n  "customerName": "홍길동",\n  "productCode": "INS-001",\n  "forceFail": true\n}',
  },
}

const retryDefaults = {
  requestedBy: 'operator1',
  reason: '외부 장애 복구 후 재실행',
  outcome: 'SUCCESS',
}

const executionStatusLabels = {
  PENDING: '대기',
  RUNNING: '진행 중',
  SUCCESS: '성공',
  FAILED: '실패',
  TIMEOUT: '시간 초과',
  CANCELLED: '취소됨',
  RETRYING: '재실행 중',
}

const triggerTypeLabels = {
  MANUAL: '직접 실행',
  SCHEDULE: '스케줄 실행',
  RETRY: '다시 실행',
}

const scenarioLabels = {
  NORMAL: '정상 실행',
  FAILURE: '실패 실행',
}

const retryOutcomeLabels = {
  SUCCESS: '성공',
  FAILURE: '실패',
}

function prettyJson(value) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function formatExecutionStatus(value) {
  return executionStatusLabels[value] ?? value ?? '-'
}

function formatTriggerType(value) {
  return triggerTypeLabels[value] ?? value ?? '-'
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

export function ExecutionsPage() {
  const queryClient = useQueryClient()
  const [interfaceId, setInterfaceId] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(executionDefaults)
  const [retryForm, setRetryForm] = useState(retryDefaults)
  const [scenario, setScenario] = useState('NORMAL')
  const [executeMessage, setExecuteMessage] = useState('')
  const [retryMessage, setRetryMessage] = useState('')

  const interfacesQuery = useQuery({
    queryKey: ['interfaces', 'all-for-execution'],
    queryFn: () => apiGet('/api/interfaces', { params: { page: 0, size: 200 } }),
  })

  const executionsQuery = useQuery({
    queryKey: ['executions', interfaceId, page],
    queryFn: () => apiGet('/api/executions', { params: { interfaceId: interfaceId || undefined, page, size: 10 } }),
  })

  const selectedExecutionQuery = useQuery({
    queryKey: ['execution-detail', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiGet(`/api/executions/${selectedId}`),
  })

  const interfaces = interfacesQuery.data?.content ?? []
  const executions = executionsQuery.data ?? { content: [], totalElements: 0, totalPages: 0 }
  const selectedExecution = selectedExecutionQuery.data ?? null

  const executeMutation = useMutation({
    mutationFn: ({ id, body }) => apiPost(`/api/interfaces/${id}/executions`, body),
    onSuccess: async (data) => {
      setExecuteMessage(`실행 요청이 접수되었어요. 실행 번호 ${data.executionId}`)
      await queryClient.invalidateQueries({ queryKey: ['executions'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-failures'] })
    },
  })

  const retryMutation = useMutation({
    mutationFn: ({ id, body }) => apiPost(`/api/executions/${id}/retry`, body),
    onSuccess: async (data, variables) => {
      setRetryMessage(`다시 실행 요청이 접수되었어요. 결과: ${retryOutcomeLabels[variables.body.outcome]} / 실행 번호 ${data.executionId}`)
      await queryClient.invalidateQueries({ queryKey: ['executions'] })
      await queryClient.invalidateQueries({ queryKey: ['execution-detail'] })
      await queryClient.invalidateQueries({ queryKey: ['logs'] })
    },
  })

  const selectedExecutionCanRetry = Boolean(
    selectedExecution &&
      (selectedExecution.executionStatus === 'FAILED' || selectedExecution.executionStatus === 'TIMEOUT') &&
      !selectedExecution.hasRetryExecution &&
      !retryMutation.isPending,
  )

  useEffect(() => {
    setRetryForm(retryDefaults)
    setRetryMessage('')
  }, [selectedId])

  const handleExecute = (event) => {
    event.preventDefault()
    if (!form.interfaceId) {
      setExecuteMessage('연동을 선택해 주세요.')
      return
    }
    try {
      const parsed = JSON.parse(form.requestBody || '{}')
      const requestBody =
        scenario === 'FAILURE'
          ? {
              ...(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}),
              forceFail: true,
            }
          : parsed
      executeMutation.mutate({
        id: Number(form.interfaceId),
          body: {
            requestedBy: form.requestedBy,
            traceId: form.traceId,
            requestBody,
          },
        })
      setExecuteMessage('')
    } catch {
      setExecuteMessage('입력한 내용은 올바른 JSON 형식이어야 해요.')
    }
  }

  const applyScenarioPreset = (presetKey) => {
    const preset = scenarioPresets[presetKey]
    if (!preset) return
    setScenario(presetKey)
    setForm((prev) => ({
      ...prev,
      requestedBy: preset.requestedBy,
      traceId: preset.traceId,
      requestBody: preset.requestBody,
    }))
  }

  const handleRetry = (event) => {
    event.preventDefault()
    if (!selectedId) return
    if (!selectedExecutionCanRetry) {
      if (selectedExecution?.hasRetryExecution) {
        setRetryMessage('이미 뒤에 다시 실행이 붙은 원본 건이라서 다시 실행할 수 없어요. 마지막 실패 실행을 선택해 주세요.')
      } else if (selectedExecution?.executionStatus === 'SUCCESS') {
        setRetryMessage('성공한 건은 다시 실행할 수 없어요.')
      } else {
        setRetryMessage('마지막 실패 실행만 다시 실행할 수 있어요.')
      }
      return
    }
    retryMutation.mutate({
      id: selectedId,
      body: retryForm,
    })
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="실행 이력"
        description="업무를 직접 실행해 보고, 결과와 다시 실행을 확인하는 화면입니다."
      />

      <section className="panel">
        <div className="toolbar">
          <select className="text-input control-select" value={interfaceId} onChange={(event) => setInterfaceId(event.target.value)}>
            <option value="">전체 연동</option>
            {interfaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.interfaceName}
              </option>
            ))}
          </select>
          <button className="secondary-button" type="button" onClick={() => setPage(0)}>
            조회
          </button>
        </div>

        <div className="split-layout">
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>번호</th>
                  <th>연동 이름</th>
                  <th>상태</th>
                  <th>실행 방식</th>
                  <th>실행 시각</th>
                  <th>요청자</th>
                </tr>
              </thead>
              <tbody>
                {executions.content.length > 0 ? (
                  executions.content.map((row) => (
                    <tr
                      key={row.executionId}
                      className={row.executionId === selectedId ? 'selected-row' : ''}
                      onClick={() => setSelectedId(row.executionId)}
                    >
                      <td>{row.executionId}</td>
                      <td>{row.interfaceName}</td>
                      <td>{formatExecutionStatus(row.executionStatus)}</td>
                      <td>{formatTriggerType(row.triggerType)}</td>
                      <td>{formatDateTime(row.startedAt)}</td>
                      <td>{row.requestedBy}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      아직 실행된 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="pagination-bar">
              <span>{executions.totalElements ?? 0}건</span>
              <div className="pagination-actions">
                <button className="ghost-button" type="button" disabled={page <= 0} onClick={() => setPage((prev) => Math.max(prev - 1, 0))}>
                  이전
                </button>
                <span>
                  {page + 1} / {Math.max(executions.totalPages || 1, 1)}
                </span>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={page + 1 >= (executions.totalPages || 1)}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </div>

          <div className="stacked-panels">
            <form className="panel form-panel" onSubmit={handleExecute}>
              <div className="panel-heading">
                <h3>업무 실행</h3>
              </div>

              <div className="scenario-banner">
                <div>
                  <strong>실행 방식 선택</strong>
                  <p>화면에서 바로 테스트해 볼 수 있도록 정상 실행과 실패 실행을 넣어두었습니다. 실패 실행은 외부 연결이 끊긴 상황을 확인하는 용도입니다.</p>
                </div>
                <div className="scenario-actions">
                  <button type="button" className={`scenario-chip ${scenario === 'NORMAL' ? 'active' : ''}`} onClick={() => applyScenarioPreset('NORMAL')}>
                    정상 실행
                  </button>
                  <button type="button" className={`scenario-chip ${scenario === 'FAILURE' ? 'active' : ''}`} onClick={() => applyScenarioPreset('FAILURE')}>
                    실패 실행
                  </button>
                </div>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>연동 선택</span>
                  <select
                    className="text-input control-select"
                    value={form.interfaceId}
                    onChange={(event) => setForm((prev) => ({ ...prev, interfaceId: event.target.value }))}
                  >
                    <option value="">선택</option>
                    {interfaces.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.interfaceName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>요청자</span>
                  <input
                    className="text-input"
                    value={form.requestedBy}
                    onChange={(event) => setForm((prev) => ({ ...prev, requestedBy: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>참조 번호</span>
                  <input
                    className="text-input"
                    value={form.traceId}
                    onChange={(event) => setForm((prev) => ({ ...prev, traceId: event.target.value }))}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button className="primary-button" type="submit">
                  실행
                </button>
              </div>

              {executeMessage ? <div className="form-feedback success">{executeMessage}</div> : null}
            </form>

            <form className="panel form-panel" onSubmit={handleRetry}>
              <div className="panel-heading">
                <h3>실행 상세</h3>
                <span>{selectedExecution ? `#${selectedExecution.executionId}` : '행을 선택해 주세요'}</span>
              </div>

              {selectedExecution ? (
                <>
                  <div className="detail-box">
                    <p>{selectedExecution.interfaceName}</p>
                    <strong>{formatExecutionStatus(selectedExecution.executionStatus)}</strong>
                    <small>
                      {formatTriggerType(selectedExecution.triggerType)} · {selectedExecution.requestedBy} · {selectedExecution.traceId}
                    </small>
                  </div>

                  <div className="detail-grid">
                    <div>
                      <span>보낸 내용</span>
                      <pre>{prettyJson(selectedExecution.requestBody)}</pre>
                    </div>
                    <div>
                      <span>받은 내용</span>
                      <pre>{prettyJson(selectedExecution.responseBody)}</pre>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <div>
                      <span>실행 시각</span>
                      <strong>{formatDateTime(selectedExecution.startedAt)}</strong>
                    </div>
                    <div>
                      <span>완료 시각</span>
                      <strong>{formatDateTime(selectedExecution.endedAt)}</strong>
                    </div>
                    <div>
                      <span>응답 상태</span>
                      <strong>{selectedExecution.responseStatusCode ?? '-'}</strong>
                    </div>
                    <div>
                      <span>처리 시간</span>
                      <strong>{selectedExecution.durationMillis ?? 0} ms</strong>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>다시 실행 결과</span>
                      <select
                        className="text-input control-select"
                        value={retryForm.outcome}
                        onChange={(event) => setRetryForm((prev) => ({ ...prev, outcome: event.target.value }))}
                      >
                        <option value="SUCCESS">성공</option>
                        <option value="FAILURE">실패</option>
                      </select>
                      <small className="field-help">테스트할 결과를 선택할 수 있어요.</small>
                    </label>
                    <label className="field">
                      <span>다시 실행 요청자</span>
                      <input
                        className="text-input"
                        value={retryForm.requestedBy}
                        onChange={(event) => setRetryForm((prev) => ({ ...prev, requestedBy: event.target.value }))}
                      />
                    </label>
                    {selectedExecutionCanRetry ? (
                      <label className="field field-full">
                        <span>사유</span>
                        <input
                          className="text-input"
                          value={retryForm.reason}
                          onChange={(event) => setRetryForm((prev) => ({ ...prev, reason: event.target.value }))}
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className="form-actions">
                    <button className="secondary-button" type="submit" disabled={!selectedExecutionCanRetry}>
                      다시 실행
                    </button>
                  </div>

                  <small className="field-help">
                    현재 선택한 건이 마지막 실행이고 최종 상태가 실패 또는 시간 초과일 때만 다시 실행할 수 있어요.
                  </small>

                  {retryMessage ? <div className="form-feedback">{retryMessage}</div> : null}

                </>
              ) : (
                <div className="empty-state">실행 건을 선택하면 상세 내용과 다시 실행을 볼 수 있어요.</div>
              )}
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
