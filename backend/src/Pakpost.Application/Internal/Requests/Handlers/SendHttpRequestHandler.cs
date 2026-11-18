using Mediator;
using Pakpost.Application.Internal.Requests.Commands;
using Pakpost.Application.Internal.Requests.DTOs;
using Pakpost.Application.Internal.Requests.Interfaces;

namespace Pakpost.Application.Internal.Requests.Handlers;

public sealed class SendHttpRequestHandler(IHttpRequestRunner runner) : IRequestHandler<SendHttpRequestCommand, SendHttpResponse>
{
    public ValueTask<SendHttpResponse> Handle(SendHttpRequestCommand cmd, CancellationToken ct) => new(runner.ExecuteAsync(cmd, ct));
}
