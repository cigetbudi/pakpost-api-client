using FluentValidation;
using Pakpost.Application.Internal.Environments.Commands;

namespace Pakpost.Application.Internal.Environments.Validators;

public sealed class CreateEnvironmentValidator : AbstractValidator<CreateEnvironmentCommand>
{
    public CreateEnvironmentValidator(){RuleFor(x => x.Name).NotEmpty().MaximumLength(120); } }
