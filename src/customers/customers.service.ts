import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity.js';
import { CustomerAddress } from './entities/customer-address.entity.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto.js';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto.js';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerAddress)
    private readonly addressRepository: Repository<CustomerAddress>,
  ) {}

  findAll(): Promise<Customer[]> {
    return this.customerRepository.find({ relations: { addresses: true } });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: { addresses: true },
    });
    if (!customer) {
      throw new NotFoundException(`Customer dengan ID ${id} tidak ditemukan`);
    }
    return customer;
  }

  create(dto: CreateCustomerDto): Promise<Customer> {
    return this.customerRepository.save(this.customerRepository.create(dto));
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    await this.findOne(id);
    await this.customerRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.customerRepository.softDelete(id);
    return { message: `Customer dengan ID ${id} berhasil dihapus` };
  }

  async findAddresses(customerId: string): Promise<CustomerAddress[]> {
    await this.findOne(customerId);
    return this.addressRepository.find({ where: { customerId } });
  }

  async findAddress(
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddress> {
    const address = await this.addressRepository.findOneBy({
      id: addressId,
      customerId,
    });
    if (!address) {
      throw new NotFoundException(
        `Address dengan ID ${addressId} tidak ditemukan`,
      );
    }
    return address;
  }

  async createAddress(
    customerId: string,
    dto: CreateCustomerAddressDto,
  ): Promise<CustomerAddress> {
    await this.findOne(customerId);
    const address = this.addressRepository.create({ ...dto, customerId });
    return this.addressRepository.save(address);
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ): Promise<CustomerAddress> {
    const address = await this.findAddress(customerId, addressId);
    Object.assign(address, dto, { id: addressId, customerId });
    return this.addressRepository.save(address);
  }

  async removeAddress(
    customerId: string,
    addressId: string,
  ): Promise<{ message: string }> {
    await this.findAddress(customerId, addressId);
    await this.addressRepository.delete({ id: addressId, customerId });
    return { message: `Address dengan ID ${addressId} berhasil dihapus` };
  }
}
