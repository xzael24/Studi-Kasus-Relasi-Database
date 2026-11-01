import {
    Controller,
    Get,
    Param,
    Post,
    Body,
    Put,
    Delete,
} from '@nestjs/common';
import { MembersService } from './members.service.js';
import { Member } from './entities/members.entity.js';
import { CreateMemberDto } from './dto/create-member-dto.js';
import { UpdateMemberDto } from './dto/update-member-dto.js';

@Controller('members')
export class MembersController {
    constructor(private readonly membersService: MembersService) {}

    // 1. READ ALL MEMBERS
    @Get()
    async findAll(): Promise<Member[]> {
        return await this.membersService.findAll();
    }

    // 2. READ ONE MEMBER (dengan parameter id)
    // Contoh akses: GET /members/1
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Member> {
        return await this.membersService.findOne(+id);
    }

    // 3. CREATE A MEMBER
    @Post()
    async create(@Body() memberData: CreateMemberDto): Promise<Member> {
        return await this.membersService.create(memberData);
    }

    // 4. UPDATE A MEMBER
    // Contoh akses: PUT /members/1
    @Put(':id')
    async update(@Param('id') id: string, @Body() updateData: UpdateMemberDto): Promise<Member> {
        return await this.membersService.update(+id, updateData);
    }

    // 5. DELETE A MEMBER
    // Contoh akses: DELETE /members/1
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<{ message: string }> {
        return await this.membersService.remove(+id);
    }
}