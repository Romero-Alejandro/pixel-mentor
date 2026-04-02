export interface ITransactionService {
  execute<T>(fn: (tx: any) => Promise<T>): Promise<T>;
}
