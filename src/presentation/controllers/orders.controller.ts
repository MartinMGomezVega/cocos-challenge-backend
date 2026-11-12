import { Body, Controller, Post } from '@nestjs/common';
import { SubmitOrderUseCase } from '../../application/use-cases/submit-order.use-case';
import { OrderResponseDto } from '../dto/order.response.dto';
import { SubmitOrderBodyDto } from '../dto/submit-order.body.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly submitOrderUseCase: SubmitOrderUseCase) {}

  @Post()
  async submit(@Body() bodyDto: SubmitOrderBodyDto): Promise<OrderResponseDto> {
    const order = await this.submitOrderUseCase.execute(bodyDto.toInput());
    return OrderResponseDto.fromDomain(order);
  }
}
