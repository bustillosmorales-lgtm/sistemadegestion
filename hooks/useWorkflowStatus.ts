/**
 * useWorkflowStatus Hook
 * Polls GitHub Actions workflow status
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { POLL_INTERVALS, WORKFLOW_STATUS } from '@/lib/constants'

interface WorkflowRun {
  id: number
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
  html_url: string
  created_at: string
  updated_at: string
}

interface UseWorkflowStatusOptions {
  /** Repository owner */
  owner: string
  /** Repository name */
  repo: string
  /** Poll interval in milliseconds */
  pollInterval?: number
  /** Maximum number of polling attempts */
  maxAttempts?: number
  /** Callback when workflow completes successfully */
  onSuccess?: (run: WorkflowRun) => void
  /** Callback when workflow fails */
  onFailure?: (run: WorkflowRun) => void
  /** Callback when timeout is reached */
  onTimeout?: () => void
  /** Callback for each status update */
  onUpdate?: (run: WorkflowRun, attempts: number) => void
}

interface UseWorkflowStatusReturn {
  /** Current workflow status */
  status: 'idle' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'timeout'
  /** Current workflow run data */
  currentRun: WorkflowRun | null
  /** Number of polling attempts */
  attempts: number
  /** Start monitoring workflow status */
  startMonitoring: () => void
  /** Stop monitoring */
  stopMonitoring: () => void
  /** Whether currently monitoring */
  isMonitoring: boolean
}

/**
 * Hook for monitoring GitHub Actions workflow status
 *
 * @example
 * const workflow = useWorkflowStatus({
 *   owner: 'myorg',
 *   repo: 'myrepo',
 *   onSuccess: (run) => {
 *     console.log('Workflow succeeded!', run)
 *   },
 *   onFailure: (run) => {
 *     console.error('Workflow failed!', run)
 *   }
 * })
 *
 * // Start monitoring
 * workflow.startMonitoring()
 */
export function useWorkflowStatus(
  options: UseWorkflowStatusOptions
): UseWorkflowStatusReturn {
  const {
    owner,
    repo,
    pollInterval = POLL_INTERVALS.WORKFLOW_STATUS,
    maxAttempts = 60, // 3 minutes at 3s intervals
    onSuccess,
    onFailure,
    onTimeout,
    onUpdate,
  } = options

  const [status, setStatus] = useState<
    'idle' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'timeout'
  >('idle')
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [isMonitoring, setIsMonitoring] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const attemptsRef = useRef(0)

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsMonitoring(false)
    attemptsRef.current = 0
    setAttempts(0)
  }, [])

  const fetchWorkflowStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs?event=workflow_dispatch&per_page=1`
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.workflow_runs && data.workflow_runs.length > 0) {
        const latestRun = data.workflow_runs[0] as WorkflowRun

        setCurrentRun(latestRun)
        attemptsRef.current++
        setAttempts(attemptsRef.current)

        // Call update callback
        if (onUpdate) {
          onUpdate(latestRun, attemptsRef.current)
        }

        // Check if workflow completed
        if (latestRun.status === 'completed') {
          stopMonitoring()

          if (latestRun.conclusion === 'success') {
            setStatus('completed')
            if (onSuccess) {
              onSuccess(latestRun)
            }
          } else {
            setStatus('failed')
            if (onFailure) {
              onFailure(latestRun)
            }
          }
        } else if (
          latestRun.status === 'in_progress' ||
          latestRun.status === 'queued'
        ) {
          setStatus(latestRun.status)
        }

        // Check for timeout
        if (attemptsRef.current >= maxAttempts) {
          stopMonitoring()
          setStatus('timeout')
          if (onTimeout) {
            onTimeout()
          }
        }
      }
    } catch (error) {
      console.error('Error fetching workflow status:', error)
    }
  }, [owner, repo, maxAttempts, onSuccess, onFailure, onTimeout, onUpdate, stopMonitoring])

  const startMonitoring = useCallback(() => {
    // Stop any existing monitoring
    stopMonitoring()

    // Reset state
    setStatus('queued')
    setCurrentRun(null)
    attemptsRef.current = 0
    setAttempts(0)
    setIsMonitoring(true)

    // Start polling
    intervalRef.current = setInterval(() => {
      fetchWorkflowStatus()
    }, pollInterval)

    // Fetch immediately
    fetchWorkflowStatus()
  }, [stopMonitoring, fetchWorkflowStatus, pollInterval])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring()
    }
  }, [stopMonitoring])

  return {
    status,
    currentRun,
    attempts,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
  }
}

/**
 * Simplified workflow monitoring hook for common use case
 *
 * @example
 * const { status, start } = useSimpleWorkflowMonitor({
 *   owner: 'myorg',
 *   repo: 'myrepo',
 *   onComplete: (success) => {
 *     if (success) {
 *       alert('Done!')
 *     } else {
 *       alert('Failed!')
 *     }
 *   }
 * })
 */
export function useSimpleWorkflowMonitor(options: {
  owner: string
  repo: string
  onComplete?: (success: boolean) => void
}) {
  const { owner, repo, onComplete } = options

  const { status, startMonitoring, stopMonitoring, attempts, currentRun } =
    useWorkflowStatus({
      owner,
      repo,
      onSuccess: () => {
        if (onComplete) {
          onComplete(true)
        }
      },
      onFailure: () => {
        if (onComplete) {
          onComplete(false)
        }
      },
      onTimeout: () => {
        if (onComplete) {
          onComplete(false)
        }
      },
    })

  return {
    status,
    attempts,
    currentRun,
    start: startMonitoring,
    stop: stopMonitoring,
  }
}
