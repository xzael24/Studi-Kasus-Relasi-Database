import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MembersService } from './members.service.js';
import { Member } from './entities/members.entity.js';

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: getRepositoryToken(Member), useValue: {} },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
