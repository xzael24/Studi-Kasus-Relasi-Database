import { Injectable, NotFoundException } from '@nestjs/common';
import { Member } from './entities/members.entity.js';
import { CreateMemberDto } from './dto/create-member-dto.js';
import { UpdateMemberDto } from './dto/update-member-dto.js';

@Injectable()
export class MembersService {
    private members: Member[] = [
        {
            id: 1,
            name: 'Budi Santoso',
            email: 'budi@email.com',
            phone: '081234567890',
            password: 'password123',
        },
        {
            id: 2,
            name: 'Siti Rahayu',
            email: 'siti@email.com',
            phone: '082345678901',
            password: 'password456',
        },
    ];

    // Auto-increment id helper
    private nextId(): number {
        return this.members.length > 0
            ? Math.max(...this.members.map((m) => m.id)) + 1
            : 1;
    }

    // 1. GET ALL MEMBERS
    findAll(): Member[] {
        return this.members;
    }

    // 2. GET ONE MEMBER BY ID
    findOne(id: number): Member {
        const member = this.members.find((m) => m.id === id);
        if (!member) {
            throw new NotFoundException(`Member dengan ID ${id} tidak ditemukan`);
        }
        return member;
    }

    // 3. CREATE A MEMBER
    create(memberData: CreateMemberDto): Member {
        const newMember: Member = {
            id: this.nextId(),
            name: memberData.name ?? '',
            email: memberData.email ?? '',
            phone: memberData.phone ?? '',
            password: memberData.password ?? '',
        };
        this.members.push(newMember);
        return newMember;
    }

    // 4. UPDATE A MEMBER
    update(id: number, updateData: UpdateMemberDto): Member {
        const index = this.members.findIndex((m) => m.id === id);
        if (index === -1) {
            throw new NotFoundException(`Member dengan ID ${id} tidak ditemukan`);
        }
        this.members[index] = { ...this.members[index], ...updateData, id };
        return this.members[index];
    }

    // 5. DELETE A MEMBER
    remove(id: number): { message: string } {
        const index = this.members.findIndex((m) => m.id === id);
        if (index === -1) {
            throw new NotFoundException(`Member dengan ID ${id} tidak ditemukan`);
        }
        this.members.splice(index, 1);
        return { message: `Member dengan ID ${id} berhasil dihapus` };
    }
}
