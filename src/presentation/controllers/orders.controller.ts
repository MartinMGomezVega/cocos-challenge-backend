import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case';
import { SubmitOrderUseCase } from '../../application/use-cases/submit-order.use-case';
import { OrderIdParamDto } from '../dto/order-id.param.dto';
import { OrderResponseDto } from '../dto/order.response.dto';
import { SubmitOrderBodyDto } from '../dto/submit-order.body.dto';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly submitOrderUseCase: SubmitOrderUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
  ) {}

  @Post()
  async submit(@Body() bodyDto: SubmitOrderBodyDto): Promise<OrderResponseDto> {
    const order = await this.submitOrderUseCase.execute(bodyDto.toInput());
    return OrderResponseDto.fromDomain(order);
  }

  @Patch(':orderId/cancel')
  async cancel(@Param() params: OrderIdParamDto): Promise<OrderResponseDto> {
    const order = await this.cancelOrderUseCase.execute(params.orderId);
    return OrderResponseDto.fromDomain(order);
  }
}
