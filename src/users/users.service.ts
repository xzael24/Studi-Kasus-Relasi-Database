import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  private users: User[] = [];

  create(data: Omit<User, 'id' | 'createdAt'>): User {
    const user: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ...data,
      createdAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  findByEmail(email: string): User | undefined {
    return this.users.find((u) => u.email === email);
  }

  findById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  findAll(): User[] {
    return this.users;
  }
}
