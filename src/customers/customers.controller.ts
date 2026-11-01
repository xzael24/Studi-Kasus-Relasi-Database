import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service.js';
import { Customer } from './entities/customer.entity.js';
import { CustomerAddress } from './entities/customer-address.entity.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto.js';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto.js';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(): Promise<Customer[]> {
    return this.customersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Customer> {
    return this.customersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto): Promise<Customer> {
    return this.customersService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.customersService.remove(id);
  }

  @Get(':id/addresses')
  findAddresses(@Param('id') id: string): Promise<CustomerAddress[]> {
    return this.customersService.findAddresses(id);
  }

  @Get(':id/addresses/:addressId')
  findAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
  ): Promise<CustomerAddress> {
    return this.customersService.findAddress(id, addressId);
  }

  @Post(':id/addresses')
  createAddress(
    @Param('id') id: string,
    @Body() dto: CreateCustomerAddressDto,
  ): Promise<CustomerAddress> {
    return this.customersService.createAddress(id, dto);
  }

  @Put(':id/addresses/:addressId')
  updateAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ): Promise<CustomerAddress> {
    return this.customersService.updateAddress(id, addressId, dto);
  }

  @Delete(':id/addresses/:addressId')
  removeAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
  ): Promise<{ message: string }> {
    return this.customersService.removeAddress(id, addressId);
  }
}
