import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// Open a connection to the database
export async function openDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
    return open({
        filename: './database.db',
        driver: sqlite3.Database,
    });
}

// Initialize the database with a simple table
export async function initializeDb(): Promise<void> {
    const db = await openDb();
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      status TEXT CHECK(status IN ('pending', 'active', 'blocked'))
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      status TEXT CHECK(status IN ('empty', 'notEmpty')) DEFAULT 'empty'
    )
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_groups (
      user_id INTEGER,
      group_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      PRIMARY KEY (user_id, group_id)
    )
  `);

}

// Function to remove a user from a group
export async function removeUserFromGroup(userId: number, groupId: number): Promise<void> {
    const db = await openDb();
  
    try {
      // Start transaction
      await db.exec('BEGIN TRANSACTION');
      
      // Remove the user from the group
      await db.run('DELETE FROM user_groups WHERE user_id = ? AND group_id = ?', [userId, groupId]);
  
      // Check if the group is now empty
      const result = await db.get('SELECT COUNT(*) AS count FROM user_groups WHERE group_id = ?', [groupId]);
      
      if (result.count === 0) {
        // Update the group status to 'empty' if no users remain
        await db.run('UPDATE groups SET status = ? WHERE id = ?', ['empty', groupId]);
      }
      
      // Commit the transaction
      await db.exec('COMMIT');
    } catch (error) {
      // Rollback in case of error
      await db.exec('ROLLBACK');
      throw new Error('Failed to remove user from group: ' + error);
    }
  }

// Retrieve users with pagination
export async function getUsersWithPagination(limit: number, offset: number): Promise<any[]> {
    const db = await openDb();
    return db.all('SELECT * FROM users LIMIT ? OFFSET ?', [limit, offset]);
}

export async function getUsersByName(name: string): Promise<any[]> {
    const db = await openDb();
    return db.all('SELECT * FROM users WHERE name = ?', [name]);
}

export async function getUsersByEmail(email: string): Promise<any[]> {
    const db = await openDb();
    return db.all('SELECT * FROM users WHERE email = ?', [email]);
}

// Update multiple users' statuses
export async function updateUserStatuses(userStatuses: { id: number, status: string }[]): Promise<void> {
    const db = await openDb();
  
    try {
      await db.exec('BEGIN TRANSACTION');
      
      // Prepare the update statement
      const updateStmt = await db.prepare('UPDATE users SET status = ? WHERE id = ?');
  
      for (const { id, status } of userStatuses) {
        // Execute the update statement for each user
        await updateStmt.run(status, id);
      }
  
      // Finalize the statement and commit the transaction
      await updateStmt.finalize();
      await db.exec('COMMIT');
    } catch (error) {
      // Rollback the transaction in case of error
      await db.exec('ROLLBACK');
      throw new Error('Failed to update user statuses: ' + error);
    }
  }