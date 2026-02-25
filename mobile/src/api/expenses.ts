import client from './client'
import type { Expense, CreateExpenseBody, UpdateExpenseBody } from '../types'

export async function listExpenses(): Promise<Expense[]> {
  const response = await client.get<Expense[]>('/expenses')
  return response.data
}

export async function getExpense(id: string): Promise<Expense> {
  const response = await client.get<Expense>(`/expenses/${id}`)
  return response.data
}

export async function createExpense(body: CreateExpenseBody): Promise<Expense> {
  const response = await client.post<Expense>('/expenses', body)
  return response.data
}

export async function updateExpense(
  id: string,
  body: UpdateExpenseBody,
): Promise<Expense> {
  const response = await client.patch<Expense>(`/expenses/${id}`, body)
  return response.data
}

export async function deleteExpense(id: string): Promise<void> {
  await client.delete(`/expenses/${id}`)
}
