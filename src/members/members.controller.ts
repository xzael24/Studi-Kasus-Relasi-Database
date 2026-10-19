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
    findAll(): Member[] {
        return this.membersService.findAll();
    }

    // 2. READ ONE MEMBER (dengan parameter id)
    // Contoh akses: GET /members/1
    @Get(':id')
    findOne(@Param('id') id: string): Member {
        return this.membersService.findOne(+id);
    }

    // 3. CREATE A MEMBER
    @Post()
    create(@Body() memberData: CreateMemberDto): Member {
        return this.membersService.create(memberData);
    }

    // 4. UPDATE A MEMBER
    // Contoh akses: PUT /members/1
    @Put(':id')
    update(@Param('id') id: string, @Body() updateData: UpdateMemberDto): Member {
        return this.membersService.update(+id, updateData);
    }

    // 5. DELETE A MEMBER
    // Contoh akses: DELETE /members/1
    @Delete(':id')
    remove(@Param('id') id: string): { message: string } {
        return this.membersService.remove(+id);
    }
}
