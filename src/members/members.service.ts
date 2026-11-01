import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from './entities/members.entity.js';
import { CreateMemberDto } from './dto/create-member-dto.js';
import { UpdateMemberDto } from './dto/update-member-dto.js';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  // 1. GET ALL MEMBERS
  async findAll(): Promise<Member[]> {
    return this.memberRepository.find();
  }

  // 2. GET ONE MEMBER BY ID
  async findOne(id: number): Promise<Member> {
    const member = await this.memberRepository.findOneBy({ id });
    if (!member) {
      throw new NotFoundException(`Member dengan ID ${id} tidak ditemukan`);
    }
    return member;
  }

  // 3. CREATE A MEMBER
  async create(memberData: CreateMemberDto): Promise<Member> {
    const newMember = this.memberRepository.create({
      name: memberData.name ?? '',
      email: memberData.email ?? '',
      phone: memberData.phone ?? '',
      password: memberData.password ?? '',
    });
    return this.memberRepository.save(newMember);
  }

  // 4. UPDATE A MEMBER
  async update(id: number, updateData: UpdateMemberDto): Promise<Member> {
    const member = await this.findOne(id);
    Object.assign(member, updateData, { id });
    return this.memberRepository.save(member);
  }

  // 5. DELETE A MEMBER
  async remove(id: number): Promise<{ message: string }> {
    const member = await this.findOne(id);
    await this.memberRepository.remove(member);
    return { message: `Member dengan ID ${id} Successfully deleted` };
  }
}