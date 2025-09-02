import Database from 'better-sqlite3'
import path from 'path'

class DatabaseManager {
  private static instance: DatabaseManager
  private db: Database.Database | null = null
  
  private constructor() {}
  
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }
  
  getDb(): Database.Database {
    if (!this.db) {
      const dbPath = path.join(process.cwd(), 'sambio_human.db')
      this.db = new Database(dbPath, { 
        readonly: false,
        fileMustExist: true // DB file must exist - don't create new one
      })
      this.initialize()
    }
    return this.db
  }
  
  private initialize() {
    if (!this.db) return
    
    // Check database integrity first
    try {
      const integrityCheck = this.db.pragma('integrity_check') as Array<{integrity_check: string}>
      if (integrityCheck[0]?.integrity_check !== 'ok') {
        console.error('Database integrity check failed:', integrityCheck)
        throw new Error('Database corruption detected. Please restore from backup.')
      }
    } catch (error) {
      console.error('Error checking database integrity:', error)
      throw error
    }
    
    // Performance optimizations
    // WAL mode disabled for external module compatibility
    this.db.pragma('journal_mode = DELETE') // Changed from WAL to DELETE mode
    this.db.pragma('cache_size = 10000')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('synchronous = FULL') // Changed from NORMAL for better durability
    this.db.pragma('busy_timeout = 5000') // Add timeout for concurrent access
    
    // Create indexes if not exist
    try {
      this.createIndexes()
    } catch (error) {
      console.error('Error creating indexes:', error)
    }
  }
  
  private createIndexes() {
    if (!this.db) return
    
    // Check if table exists before creating indexes
    const tableExists = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='tag_data'
    `).get()
    
    if (!tableExists) {
      console.log('Database tables not found. Please ensure sambio_human.db is in the data directory.')
      return
    }
    
    // Create performance indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_tag_data_employee_date ON tag_data(사번, DATE(ENTE_DT))',
      'CREATE INDEX IF NOT EXISTS idx_tag_data_timestamp ON tag_data(ENTE_DT)',
      'CREATE INDEX IF NOT EXISTS idx_meal_data_employee_date ON meal_data(사번, DATE(취식일시))',
    ]
    
    for (const indexSql of indexes) {
      try {
        this.db.exec(indexSql)
      } catch (error) {
        console.log(`Index might already exist: ${error}`)
      }
    }
  }
  
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

export default DatabaseManager
export const db = DatabaseManager.getInstance()