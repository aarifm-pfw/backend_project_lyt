// src/app.ts
import express, { Request, Response } from 'express';
import { openDb, initializeDb, getUsersWithPagination, getUsersByName, getUsersByEmail, updateUserStatuses, removeUserFromGroup } from './database';

const app = express();
const port = 8080;

// Middleware to parse JSON bodies
app.use(express.json());

// Initialize the database
initializeDb().catch(err => console.error('Failed to initialize database:', err));

// Define a route to get all users
app.get('/users', async (req: Request, res: Response) => {
    const { limit = 10, offset = 0 } = req.query;

    const limitNumber = parseInt(limit as string, 10);
    const offsetNumber = parseInt(offset as string, 10);
    if (isNaN(limitNumber) || isNaN(offsetNumber) || limitNumber < 0 || offsetNumber < 0) {
        return res.status(400).json({ error: 'Invalid limit or offset' });
    }

    try {
        const users = await getUsersWithPagination(limitNumber, offsetNumber);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
});

app.get('/users/filter', async (req: Request, res: Response) => {
    const { name } = req.query;

    if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Invalid name query parameter' });
    }

    try {
        const users = await getUsersByName(name);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve users by name' });
    }
});

// Define a route to add a new user
app.post('/users', async (req: Request, res: Response) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    const db = await openDb();
    try {
        const result = await db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
        res.json({ id: result.lastID, name, email });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add user' });
    }
});

app.get('/users/filter/email', async (req: Request, res: Response) => {
    const { email } = req.query;

    if (typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({ error: 'Invalid email query parameter' });
    }

    try {
        const users = await getUsersByEmail(email);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve users by email' });
    }
});

app.put('/users/:id/email', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id, 10);
    const { email } = req.body;

    if (isNaN(userId) || !email) {
        return res.status(400).json({ error: 'Invalid user ID or email' });
    }

    const db = await openDb();
    try {
        const result = await db.run('UPDATE users SET email = ? WHERE id = ?', [email, userId]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ id: userId, email });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user email' });
    }
});

// Define a route to update multiple users' statuses
app.put('/users/statuses', async (req: Request, res: Response) => {
    const userStatuses = req.body;

    if (!Array.isArray(userStatuses) || userStatuses.length === 0) {
        return res.status(400).json({ error: 'Invalid request body. Must be an array of user status updates' });
    }

    // Validate userStatuses array
    for (const { id, status } of userStatuses) {
        if (typeof id !== 'number' || !['pending', 'active', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Invalid user ID or status' });
        }
    }

    try {
        await updateUserStatuses(userStatuses);
        res.json({ message: 'User statuses updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user statuses' });
    }
});

// Define a route to remove a user from a group
app.delete('/users/:userId/groups/:groupId', async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId, 10);
    const groupId = parseInt(req.params.groupId, 10);

    if (isNaN(userId) || isNaN(groupId)) {
        return res.status(400).json({ error: 'Invalid user ID or group ID' });
    }

    try {
        await removeUserFromGroup(userId, groupId);
        res.json({ message: 'User removed from group successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove user from group' });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
