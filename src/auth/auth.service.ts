import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { Member } from '../members/entities/members.entity.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
    // Simulasi database member (in-memory)
    private members: Member[] = [
        {
            id: 1,
            name: 'Budi Santoso',
            email: 'budi@email.com',
            phone: '081234567890',
            password: 'password123',
        },
    ];

    private nextId(): number {
        return this.members.length > 0
            ? Math.max(...this.members.map((m) => m.id)) + 1
            : 1;
    }

    // REGISTER
    register(registerDto: RegisterDto): { message: string; user: Omit<Member, 'password'> } {
        // Cek apakah email sudah terdaftar
        const existing = this.members.find((m) => m.email === registerDto.email);
        if (existing) {
            throw new ConflictException('Email sudah terdaftar');
        }

        const newMember: Member = {
            id: this.nextId(),
            name: registerDto.name,
            email: registerDto.email,
            phone: registerDto.phone ?? '',
            password: registerDto.password, // di production: harus di-hash dulu
        };

        this.members.push(newMember);

        // Jangan kembalikan password
        const { password: _password, ...userWithoutPassword } = newMember;
        return {
            message: 'Registrasi berhasil',
            user: userWithoutPassword,
        };
    }

    // LOGIN
    login(loginDto: LoginDto): { message: string; user: Omit<Member, 'password'> } {
        // Cari member berdasarkan email
        const member = this.members.find((m) => m.email === loginDto.email);

        // Cek email dan password
        if (!member || member.password !== loginDto.password) {
            throw new UnauthorizedException('Email atau password salah');
        }

        // Jangan kembalikan password
        const { password: _password, ...userWithoutPassword } = member;
        return {
            message: 'Login berhasil',
            user: userWithoutPassword,
        };
    }
}
