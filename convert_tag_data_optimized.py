#!/usr/bin/env python3
import sqlite3
import sys
import time
from datetime import datetime

def convert_tag_data_batch():
    """
    1-5월 tag_data를 sambio_analytics.db의 master_events_table로 변환 (최적화된 버전)
    배치 크기를 줄이고 진행상황을 표시합니다.
    """
    
    human_db_path = '/Users/hanskim/Projects/SambioHRR/sambio_human.db'
    analytics_db_path = '/Users/hanskim/Projects/SambioHRR/sambio_analytics.db'
    
    try:
        # Connect to both databases
        human_conn = sqlite3.connect(human_db_path)
        analytics_conn = sqlite3.connect(analytics_db_path)
        
        human_cursor = human_conn.cursor()
        analytics_cursor = analytics_conn.cursor()
        
        print("📊 1-5월 tag_data → master_events_table 변환 시작")
        
        # Check current master_events_table size
        analytics_cursor.execute("SELECT COUNT(*) FROM master_events_table")
        current_count = analytics_cursor.fetchone()[0]
        print(f"현재 master_events_table 레코드 수: {current_count:,}")
        
        # Count total records to convert (1-5월만)
        human_cursor.execute("""
            SELECT COUNT(*) FROM tag_data 
            WHERE substr(날짜, 1, 7) IN ('2025-01', '2025-02', '2025-03', '2025-04', '2025-05')
        """)
        total_records = human_cursor.fetchone()[0]
        print(f"변환할 1-5월 tag_data 레코드 수: {total_records:,}")
        
        if total_records == 0:
            print("❌ 변환할 1-5월 데이터가 없습니다.")
            return
            
        # Process in smaller batches (5000 records at a time)
        batch_size = 5000
        processed = 0
        start_time = time.time()
        
        # Get data in batches
        offset = 0
        while offset < total_records:
            batch_start_time = time.time()
            
            print(f"\n📦 배치 처리: {offset:,} ~ {min(offset + batch_size, total_records):,}")
            
            # Fetch batch
            human_cursor.execute("""
                SELECT 
                    사번,
                    날짜,
                    시간,
                    위치,
                    장비번호,
                    CASE 
                        WHEN 위치 LIKE '%식당%' OR 위치 LIKE '%카페%' THEN 'meal'
                        WHEN 위치 LIKE '%회의%' OR 위치 LIKE '%미팅%' THEN 'meeting' 
                        WHEN 위치 LIKE '%휴게%' OR 위치 LIKE '%라운지%' THEN 'rest'
                        WHEN 위치 LIKE '%화장실%' OR 위치 LIKE '%복도%' THEN 'movement'
                        ELSE 'work'
                    END as activity_type
                FROM tag_data 
                WHERE substr(날짜, 1, 7) IN ('2025-01', '2025-02', '2025-03', '2025-04', '2025-05')
                ORDER BY 사번, 날짜, 시간
                LIMIT ? OFFSET ?
            """, (batch_size, offset))
            
            batch_records = human_cursor.fetchall()
            
            if not batch_records:
                break
                
            # Convert and insert batch
            insert_data = []
            for record in batch_records:
                사번, 날짜, 시간, 위치, 장비번호, activity_type = record
                
                # Create datetime
                try:
                    dt = datetime.strptime(f"{날짜} {시간}", "%Y-%m-%d %H:%M:%S")
                    timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
                except:
                    continue  # Skip invalid datetime
                    
                insert_data.append((
                    사번,           # employee_id
                    timestamp,      # timestamp  
                    activity_type,  # activity_type
                    위치 or '',     # location_name
                    장비번호 or '', # equipment_id
                    1.0,           # confidence_score (기본값)
                    'tag_data',    # data_source
                    None,          # additional_info
                    timestamp      # created_at
                ))
            
            # Insert batch
            if insert_data:
                analytics_cursor.executemany("""
                    INSERT OR IGNORE INTO master_events_table 
                    (employee_id, timestamp, activity_type, location_name, equipment_id, 
                     confidence_score, data_source, additional_info, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, insert_data)
                
                analytics_conn.commit()
                
            processed += len(batch_records)
            offset += batch_size
            
            # Progress info
            batch_time = time.time() - batch_start_time
            total_time = time.time() - start_time
            progress = (processed / total_records) * 100
            avg_time_per_record = total_time / processed if processed > 0 else 0
            eta_seconds = avg_time_per_record * (total_records - processed)
            
            print(f"✅ 배치 완료: {len(insert_data):,}개 변환/삽입 ({batch_time:.1f}초)")
            print(f"📊 전체 진행률: {progress:.1f}% ({processed:,}/{total_records:,})")
            print(f"⏱️  예상 완료 시간: {eta_seconds/60:.1f}분 후")
            
            # Prevent timeout by yielding
            time.sleep(0.1)
        
        # Final verification
        analytics_cursor.execute("SELECT COUNT(*) FROM master_events_table")
        final_count = analytics_cursor.fetchone()[0]
        added_records = final_count - current_count
        
        total_time = time.time() - start_time
        
        print(f"\n🎯 변환 완료!")
        print(f"📈 추가된 레코드: {added_records:,}")
        print(f"📊 최종 master_events_table 크기: {final_count:,}")
        print(f"⏱️  총 소요시간: {total_time/60:.1f}분")
        print(f"🚀 처리 속도: {processed/(total_time):.0f} records/sec")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            human_conn.close()
            analytics_conn.close()
        except:
            pass

if __name__ == "__main__":
    convert_tag_data_batch()