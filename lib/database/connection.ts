import Database from 'better-sqlite3'
import path from 'path'

class DatabaseManager {
  private static instance: DatabaseManager | null = null
  private db: Database.Database | null = null
  private currentDbPath: string | null = null

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  getDb(): Database.Database {
    // DB 경로 결정 로직
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
    const isDevelopment = process.env.NODE_ENV === 'development'
    const isWindows = process.platform === 'win32'

    let dbPath: string

    if (isBuildTime || isDevelopment) {
      // 빌드 타임 또는 개발 모드: 프로젝트 루트의 DB 사용
      dbPath = path.join(process.cwd(), 'sambio_human.db')
    } else {
      // 프로덕션 모드: 프로젝트 루트의 DB 사용 (npm start용)
      dbPath = path.join(process.cwd(), 'sambio_human.db')
    }

    // If DB path changed or no DB connection, create new connection
    if (!this.db || this.currentDbPath !== dbPath) {
      // Close old connection if exists
      if (this.db) {
        console.log('[DatabaseManager] DB path changed from', this.currentDbPath, 'to', dbPath)
        this.db.close()
        this.db = null
      }

      this.currentDbPath = dbPath
      console.log('[DatabaseManager] ===== DATABASE INITIALIZATION =====')
      console.log('[DatabaseManager] Environment:', isDevelopment ? 'development' : 'production')
      console.log('[DatabaseManager] Platform:', process.platform)
      console.log('[DatabaseManager] isBuildTime:', isBuildTime)
      console.log('[DatabaseManager] process.cwd():', process.cwd())
      console.log('[DatabaseManager] Using DB path:', dbPath)

      // Check if file exists
      const fs = require('fs')
      if (!fs.existsSync(dbPath)) {
        const errorMsg = `Database file not found at: ${dbPath}`
        console.error('[DatabaseManager]', errorMsg)
        throw new Error(errorMsg)
      }

      const stats = fs.statSync(dbPath)
      console.log('[DatabaseManager] DB file size:', (stats.size / 1024 / 1024 / 1024).toFixed(2), 'GB')

      this.db = new Database(dbPath, {
        readonly: false,
        fileMustExist: true // Don't create new DB if missing - throw error instead
      })

      // Verify tables exist
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
      console.log('[DatabaseManager] Tables found:', tables.length)
      console.log('[DatabaseManager] First 10 tables:', tables.slice(0, 10).map((t: any) => t.name).join(', '))

      const dailyAnalysisExists = tables.find((t: any) => t.name === 'daily_analysis_results')
      if (dailyAnalysisExists) {
        console.log('[DatabaseManager] ✓ daily_analysis_results table exists')
      } else {
        console.error('[DatabaseManager] ✗ daily_analysis_results table NOT FOUND!')
      }

      this.initialize()
    }
    return this.db
  }
  
  private initialize() {
    if (!this.db) return

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