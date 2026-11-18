using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed class UpdateSavedRequestValidator : AbstractValidator<UpdateSavedRequestCommand>
{
    public UpdateSavedRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Method).Must(x => x is not null && new[]{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}.Contains(x.ToUpperInvariant()));
        RuleFor(x => x.Url).NotEmpty().MaximumLength(2048);
        RuleFor(x => x.HeadersJson).Must(IsJsonObject).WithMessage("HeadersJson must be a JSON object");
        RuleFor(x => x.HeadersJson).Must(SavedHeaderPolicy.ContainsNoLiteralCredentials)
        .WithMessage("Do not save literal tokens/passwords in sensitive headers. Use {{token}} / {{apiKey}} environment placeholders.");
        RuleFor(x => x.Body).MaximumLength(131072);
        RuleFor(x => x.BodyMode).Must(x => new[]{"none", "raw", "urlencoded", "multipart", "binary"}.Contains(x));
        RuleFor(x => x.FormFieldsJson).Must(IsJsonArray).WithMessage("FormFieldsJson must be a JSON array");
        RuleFor(x => x.PreRequestScript).MaximumLength(64000);
        RuleFor(x => x.PostResponseScript).MaximumLength(64000);
    }
    private static bool IsJsonObject(string value){try{using var data = JsonDocument.Parse(value);
            return data.RootElement.ValueKind == JsonValueKind.Object; }catch{return false; }}
    private static bool IsJsonArray(string value){try{using var data = JsonDocument.Parse(value);
            return data.RootElement.ValueKind == JsonValueKind.Array; }catch{return false; }}
}
