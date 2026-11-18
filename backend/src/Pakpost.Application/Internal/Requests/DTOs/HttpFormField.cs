using FluentValidation;
using Mediator;

namespace Pakpost.Application.Internal.Requests;

public sealed record HttpFormField(string Key, string? Value, string? FileName, string? Base64, string? ContentType);
