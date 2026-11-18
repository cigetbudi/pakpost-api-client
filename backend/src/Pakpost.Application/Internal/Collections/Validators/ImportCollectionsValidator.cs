using System.Text.Json;
using FluentValidation;
using Pakpost.Application.Internal.Collections.Commands;

namespace Pakpost.Application.Internal.Collections.Validators;

public sealed class ImportCollectionsValidator : AbstractValidator<ImportCollectionsCommand>
{
    public ImportCollectionsValidator()
    {
        RuleFor(x => x.Collections).NotNull().Must(x => x is { Count: > 0 and <= 30 })
        .WithMessage("Import requires between 1 and 30 collections");
        RuleFor(x => x.Collections).Must(x => x is not null && x.All(c => c is not null && c.Requests is not null && c.Variables is not null)
            && x.Sum(c => c.Requests.Count) <= 200).WithMessage("Cloud import supports at most 200 requests");
    }
}
