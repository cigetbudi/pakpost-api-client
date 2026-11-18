using FluentValidation;
using Pakpost.Application.Internal.Collections.Commands;

namespace Pakpost.Application.Internal.Collections.Validators;

public sealed class RenameCollectionValidator : AbstractValidator<RenameCollectionCommand>
{
    public RenameCollectionValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
}
