import {
  IsIn,
  IsInt,
  IsNumber,
  IsPositive,
  Max,
  Min,
  ValidateBy,
  ValidateIf,
  ValidationArguments,
} from 'class-validator';
import { Decimal } from 'decimal.js';
import type { SubmitOrderInput } from '../../application/use-cases/submit-order.use-case';
import type { OrderSide, OrderType } from '../../domain/orders/order';

export class SubmitOrderBodyDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId!: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  instrumentId!: number;

  @IsIn(['BUY', 'SELL'])
  side!: OrderSide;

  @IsIn(['MARKET', 'LIMIT'])
  type!: OrderType;

  @ValidateIf(
    (o: SubmitOrderBodyDto) => o.amount === undefined || o.size !== undefined,
  )
  @IsInt()
  @Min(1)
  @Max(2147483647)
  @ValidateBy({
    name: 'mutuallyExclusiveSizeAndAmount',
    validator: {
      validate: (_value: unknown, args: ValidationArguments) => {
        const obj = args.object as SubmitOrderBodyDto;
        return !(obj.size !== undefined && obj.amount !== undefined);
      },
      defaultMessage: () => 'Provide either size or amount, not both',
    },
  })
  size?: number;

  @ValidateIf((o: SubmitOrderBodyDto) => o.size === undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1000000000000)
  amount?: number;

  @ValidateIf(
    (o: SubmitOrderBodyDto) => o.type === 'LIMIT' || o.price !== undefined,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(99999999.99)
  @ValidateBy({
    name: 'priceOnlyForLimitOrder',
    validator: {
      validate: (_value: unknown, args: ValidationArguments) => {
        const obj = args.object as SubmitOrderBodyDto;
        return obj.type === 'LIMIT';
      },
      defaultMessage: () => 'price is only allowed for LIMIT orders',
    },
  })
  price?: number;

  toInput(): SubmitOrderInput {
    return {
      userId: this.userId,
      instrumentId: this.instrumentId,
      side: this.side,
      type: this.type,
      size: this.size,
      amount:
        this.amount !== undefined
          ? new Decimal(String(this.amount))
          : undefined,
      price:
        this.price !== undefined ? new Decimal(String(this.price)) : undefined,
    };
  }
}
