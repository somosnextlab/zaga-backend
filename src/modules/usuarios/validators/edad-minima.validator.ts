import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsEdadMinima(
  edadMinima: number = 18,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEdadMinima',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [edadMinima],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (!value) return true; // Si no hay valor, no validar (es opcional)

          if (typeof value !== 'string') return false;

          const fechaNacimiento = new Date(value);
          const hoy = new Date();
          const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
          const mes = hoy.getMonth() - fechaNacimiento.getMonth();

          // Ajustar edad si aún no ha cumplido años este año
          const edadReal =
            mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())
              ? edad - 1
              : edad;

          return edadReal >= args.constraints[0];
        },
        defaultMessage(args: ValidationArguments) {
          return `Debe ser mayor de ${args.constraints[0]} años`;
        },
      },
    });
  };
}
