using FluentValidation;
using Pakpost.Application.Internal.Collections.Commands;

namespace Pakpost.Application.Internal.Collections.Validators;

public sealed class CreateCollectionValidator : AbstractValidator<CreateCollectionCommand>
{
    public CreateCollectionValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
}
