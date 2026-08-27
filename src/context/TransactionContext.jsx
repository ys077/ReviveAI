import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { transactions as originalTransactions } from '../data/transactions.js'

export const STORAGE_KEY = 'reviveai_transactions'

const TransactionContext = createContext(null)

function cloneDemoTransactions() {
  return originalTransactions.map((transaction) => ({ ...transaction }))
}

function isTransactionRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && value.id != null
}

export function isValidTransactionList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isTransactionRecord)
}

function getBrowserStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Read saved demo state. Corrupted JSON or invalid shapes fall back to the seed dataset.
 */
export function loadTransactionsFromStorage(storage = getBrowserStorage()) {
  if (!storage) return cloneDemoTransactions()

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return cloneDemoTransactions()

    const parsed = JSON.parse(raw)
    if (!isValidTransactionList(parsed)) return cloneDemoTransactions()

    return parsed.map((transaction) => ({ ...transaction }))
  } catch {
    return cloneDemoTransactions()
  }
}

export function persistTransactions(transactions, storage = getBrowserStorage()) {
  if (!storage) return false

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(transactions))
    return true
  } catch {
    return false
  }
}

export function applyTransactionUpdate(list, id, updates) {
  if (!Array.isArray(list) || id == null) return list
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return list

  return list.map((transaction) => {
    if (transaction.id !== id) return transaction
    return { ...transaction, ...updates, id: transaction.id }
  })
}

export function applyStatusUpdate(list, id, status, additionalData) {
  const extras =
    additionalData && typeof additionalData === 'object' && !Array.isArray(additionalData)
      ? additionalData
      : {}

  return applyTransactionUpdate(list, id, { ...extras, status })
}

export function TransactionProvider({ children }) {
  const [transactions, setTransactions] = useState(loadTransactionsFromStorage)

  useEffect(() => {
    persistTransactions(transactions)
  }, [transactions])

  const updateTransaction = useCallback((id, updates) => {
    setTransactions((current) => applyTransactionUpdate(current, id, updates))
  }, [])

  const updateTransactionStatus = useCallback((id, status, additionalData) => {
    setTransactions((current) => applyStatusUpdate(current, id, status, additionalData))
  }, [])

  const resetDemoData = useCallback(() => {
    const restored = cloneDemoTransactions()
    persistTransactions(restored)
    setTransactions(restored)
  }, [])

  const value = useMemo(
    () => ({
      transactions,
      updateTransaction,
      updateTransactionStatus,
      resetDemoData,
    }),
    [transactions, updateTransaction, updateTransactionStatus, resetDemoData],
  )

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  )
}

export function useTransactions() {
  const context = useContext(TransactionContext)

  if (!context) {
    throw new Error('useTransactions must be used within TransactionProvider')
  }

  return context
}

/**
 * No-dependency checks for load/update/reset/persist behavior.
 * Import selfCheckTransactionState() from this module in a Vite-aware runner if needed.
 */
export function selfCheckTransactionState() {
  const memory = new Map()
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => {
      memory.set(key, String(value))
    },
    removeItem: (key) => {
      memory.delete(key)
    },
  }

  const seed = loadTransactionsFromStorage(storage)
  const updated = applyTransactionUpdate(seed, seed[0].id, { status: 'Recovered', recoveredAmount: 100 })
  const statusUpdated = applyStatusUpdate(updated, seed[0].id, 'Recovered', {
    recoveredAmount: 100,
    recoveredAt: '2026-08-27T10:00:00+05:30',
    recoveryResult: 'success',
    alternativePaymentMethod: 'UPI',
    deferredUntil: null,
  })

  persistTransactions(statusUpdated, storage)
  const restored = loadTransactionsFromStorage(storage)

  memory.set(STORAGE_KEY, '{not-json')
  const fallback = loadTransactionsFromStorage(storage)

  return {
    seedCount: seed.length,
    updatePreservesFields: updated[0].customer === seed[0].customer && updated[0].status === 'Recovered',
    statusFieldsPresent: restored[0].recoveredAmount === 100 && restored[0].recoveryResult === 'success',
    persistedCount: restored.length,
    invalidJsonFallsBack: fallback.length === originalTransactions.length,
    resetCount: cloneDemoTransactions().length,
  }
}
