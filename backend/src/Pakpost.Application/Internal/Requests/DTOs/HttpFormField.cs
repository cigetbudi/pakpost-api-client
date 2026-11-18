
namespace Pakpost.Application.Internal.Requests.DTOs;

public sealed record HttpFormField(string Key, string? Value, string? FileName, string? Base64, string? ContentType);
