import {
  Order,
  OrderSide,
  OrderStatus,
  OrderType,
  RejectionReason,
} from '../../domain/orders/order';
import { toFixed2 } from '../../domain/shared/decimal-format';

export class OrderResponseDto {
  id!: number;
  userId!: number;
  instrumentId!: number;
  side!: OrderSide;
  type!: OrderType;
  size!: number;
  price!: string;
  status!: OrderStatus;
  rejectionReason!: RejectionReason | null;
  datetime!: string;

  static fromDomain(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.userId = order.userId;
    dto.instrumentId = order.instrumentId;
    dto.side = order.side;
    dto.type = order.type;
    dto.size = order.size;
    dto.price = toFixed2(order.price);
    dto.status = order.status;
    dto.rejectionReason = order.rejectionReason;
    dto.datetime = order.datetime.toISOString();
    return dto;
  }
}
